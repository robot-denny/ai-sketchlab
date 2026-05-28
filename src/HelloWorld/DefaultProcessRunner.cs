using System.Diagnostics;

namespace HelloWorld;

// Thin anti-corruption boundary around the only un-unit-testable part: the literal
// Process.Start + stream read + WaitForExit. Everything bug-prone (exit-code→success,
// stderr-append, null-process handling, the Win32Exception diagnostic, temp-file cleanup,
// argument composition) lives in CliImageGenerator and is unit-tested by substituting
// IProcessRunner. This class is covered by the E2E generate path.
//
// Win32Exception is intentionally NOT caught here — it propagates to CliImageGenerator,
// which owns the NodeBinPath diagnostic.
internal sealed class DefaultProcessRunner : IProcessRunner
{
    public async Task<ProcessRunResult?> RunAsync(ProcessStartInfo startInfo)
    {
        var process = Process.Start(startInfo);
        if (process == null)
            return null;

        try
        {
            // Drain both pipes concurrently to avoid a deadlock: if one pipe buffer fills
            // while we're sequentially awaiting the other, the child blocks on write,
            // the unread pipe never reaches EOF, and the read never returns.
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            return new ProcessRunResult(process.ExitCode, stdout, stderr);
        }
        finally
        {
            process.Dispose();
        }
    }
}
