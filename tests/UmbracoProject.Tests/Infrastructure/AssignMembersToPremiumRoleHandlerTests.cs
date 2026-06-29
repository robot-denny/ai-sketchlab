using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace UmbracoProject.Tests.Infrastructure;

// Characterization tests for AssignMembersToPremiumRoleHandler, pinning its current behavior
// before the planned move into the UmbracoProject.Features RCL (arch-feature-folder-migration
// Step 2). They assert the per-member assign/skip logic against a substituted IMemberService;
// after the move, only the reference's namespace changes and these tests must stay GREEN —
// proving the relocation preserved behavior. The multi-member test is the load-bearing one: it
// exercises the handler's foreach over SavedEntities, so a refactor that collapsed the loop to a
// single-item path would turn these tests red instead of slipping through.
//
// Out of scope (deliberately): the handler's LogInformation call on the assign path. Logging is a
// fire-and-forget side-effect, NullLogger is the project's established test pattern, and asserting
// on it would couple these tests to log wording without protecting behavior.
public class AssignMembersToPremiumRoleHandlerTests
{
    // Mirrors the handler's own `private const string RoleName = "H5YR"`, which is inaccessible
    // from the test project. Keep these two in sync manually if the role name ever changes.
    private const string RoleName = "H5YR";

    private readonly IMemberService _memberService = Substitute.For<IMemberService>();
    private readonly AssignMembersToPremiumRoleHandler _handler;

    public AssignMembersToPremiumRoleHandlerTests()
        => _handler = new AssignMembersToPremiumRoleHandler(
            _memberService,
            NullLogger<AssignMembersToPremiumRoleHandler>.Instance);

    private static IMember MemberWithId(int id)
    {
        var member = Substitute.For<IMember>();
        member.Id.Returns(id);
        return member;
    }

    [Fact]
    public void Handle_WhenMemberLacksPremiumRole_AssignsRoleOnce()
    {
        const int memberId = 42;
        var member = MemberWithId(memberId);
        _memberService.GetAllRoles(memberId).Returns(new[] { "Subscriber", "Editor" });

        _handler.Handle(new MemberSavedNotification(member, new EventMessages()));

        _memberService.Received(1).AssignRole(memberId, RoleName);
    }

    [Fact]
    public void Handle_WhenMemberAlreadyHasPremiumRole_DoesNotAssignRole()
    {
        const int memberId = 42;
        var member = MemberWithId(memberId);
        _memberService.GetAllRoles(memberId).Returns(new[] { "Subscriber", RoleName });

        _handler.Handle(new MemberSavedNotification(member, new EventMessages()));

        _memberService.DidNotReceive().AssignRole(Arg.Any<int>(), Arg.Any<string>());
    }

    [Fact]
    public void Handle_WithMultipleMembers_AssignsOnlyToThoseLackingRole()
    {
        const int lacksRoleId = 1;
        const int hasRoleId = 2;
        var memberLacking = MemberWithId(lacksRoleId);
        var memberAlreadyPremium = MemberWithId(hasRoleId);
        _memberService.GetAllRoles(lacksRoleId).Returns(new[] { "Subscriber" });
        _memberService.GetAllRoles(hasRoleId).Returns(new[] { RoleName });

        _handler.Handle(new MemberSavedNotification(
            new[] { memberLacking, memberAlreadyPremium }, new EventMessages()));

        _memberService.Received(1).AssignRole(lacksRoleId, RoleName);
        _memberService.DidNotReceive().AssignRole(hasRoleId, RoleName);
    }

    [Fact]
    public void Handle_WhenNoMembersSaved_DoesNothing()
    {
        _handler.Handle(new MemberSavedNotification(
            Array.Empty<IMember>(), new EventMessages()));

        _memberService.DidNotReceive().AssignRole(Arg.Any<int>(), Arg.Any<string>());
    }
}
