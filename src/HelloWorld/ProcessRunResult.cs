namespace HelloWorld;

public sealed record ProcessRunResult(int ExitCode, string StandardOutput, string StandardError);
