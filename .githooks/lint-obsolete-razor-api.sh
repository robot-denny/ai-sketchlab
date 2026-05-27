#!/bin/sh
# Lint: fail if a Razor view uses an obsolete IPublishedContent navigation
# property (.Parent / bare .Children) or the obsolete Udi family (.ContentUdi /
# .SettingsUdi / Udi. / .GetUdi()) OUTSIDE a `#pragma warning disable CS0618`
# region. All are CS0618 and removed in Umbraco 18.
#
# WHY THIS EXISTS
# ---------------
# Umbraco Cloud compiles .cshtml at runtime (first request). That runtime Razor
# compile reads the compilation options embedded in UmbracoProject.deps.json,
# which carry <TreatWarningsAsErrors> as a boolean but have NO channel for the
# csproj <NoWarn> list. So an obsolete-API call (CS0618) that builds fine locally
# 500s on Cloud on first request to any page that renders the view.
#
# `dotnet build` cannot catch this: the strongly-typed PublishedModels are
# generated at runtime (ModelsBuilder InMemoryAuto mode), so build-time Razor
# compilation (RazorCompileOnBuild) fails on CS0234 ("type Home/Article/... does
# not exist") long before it could reach CS0618. A true build-time Razor gate
# would require switching ModelsBuilder to a source-code mode (a separate,
# larger change). Until then, this targeted lint is the feasible stand-in.
#
# THE FIX WHEN THIS FIRES
# -----------------------
# Wrap the obsolete call:
#     #pragma warning disable CS0618
#     ... obsolete .Parent / .Children call ...
#     #pragma warning restore CS0618
# and leave a TODO(arch-obsolete-api-migration) marker pointing at the real
# IDocumentNavigationQueryService migration. Reference: Views/Partials/v2/_SiteHead.cshtml.
#
# Scope is deliberately tight to stay false-positive free: the bare .Parent /
# .Children PROPERTIES (not the typed extension overloads .Children<T>() /
# .AncestorOrSelf<T>(), which are NOT obsolete and render fine — the home page
# proves it), plus the unambiguous Udi accessors. Extend the patterns in the awk
# block below if a new obsolete member starts 500ing in production.

set -eu

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
VIEWS_DIR="$REPO_ROOT/src/UmbracoProject/Views"

if [ ! -d "$VIEWS_DIR" ]; then
  echo "lint-obsolete-razor-api: Views dir not found ($VIEWS_DIR) — nothing to scan."
  exit 0
fi

# awk scans each .cshtml, tracking whether we're inside a CS0618-disabled region,
# and reports any bare .Parent / .Children used outside one. // comments are
# stripped first so prose like "the obsolete .Parent call" never trips the lint.
violations=$(find "$VIEWS_DIR" -name '*.cshtml' -print0 | xargs -0 awk '
  FNR == 1 { disabled = 0 }
  # A "disable" that targets CS0618 (or a bare disable-all with no codes) opens a region.
  /#pragma[ \t]+warning[ \t]+disable/ && (/0618/ || $0 !~ /[0-9]/) { disabled = 1; next }
  /#pragma[ \t]+warning[ \t]+restore/ && (/0618/ || $0 !~ /[0-9]/) { disabled = 0; next }
  {
    if (disabled) next
    line = $0
    sub(/\/\/.*/, "", line)   # drop // comments before matching
    # Obsolete IPublishedContent navigation (bare .Parent / .Children) and the
    # obsolete Udi family (.ContentUdi / .SettingsUdi / Udi. / .GetUdi()), both
    # CS0618 and both removed in Umbraco 18. Use .Content.Key / .ContentKey etc.
    if (line ~ /\.Parent([^A-Za-z0-9_]|$)/ ||
        line ~ /\.Children([^A-Za-z0-9_<(]|$)/ ||
        line ~ /\.(ContentUdi|SettingsUdi)([^A-Za-z0-9_]|$)/ ||
        line ~ /\.GetUdi([^A-Za-z0-9_]|$)/ ||
        line ~ /(^|[^A-Za-z0-9_])Udi\./) {
      printf "%s:%d:%s\n", FILENAME, FNR, $0
    }
  }
')

if [ -n "$violations" ]; then
  echo "✗ Obsolete Razor navigation API used without a CS0618 pragma guard:"
  echo ""
  echo "$violations" | sed "s#$REPO_ROOT/##"
  echo ""
  echo "  These compile locally but 500 on Umbraco Cloud's runtime Razor compile"
  echo "  (TWAE is honored there; csproj <NoWarn> is not). Wrap each call in:"
  echo "      #pragma warning disable CS0618 ... #pragma warning restore CS0618"
  echo "  See Views/Partials/v2/_SiteHead.cshtml for the established pattern."
  exit 1
fi

echo "✓ lint-obsolete-razor-api: no unguarded obsolete Razor navigation APIs."
exit 0
