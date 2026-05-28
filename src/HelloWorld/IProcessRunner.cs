using System.Diagnostics;

namespace HelloWorld;

public interface IProcessRunner
{
    Task<ProcessRunResult?> RunAsync(ProcessStartInfo startInfo);
}
