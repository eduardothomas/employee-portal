namespace EmployeePortal.Infrastructure.Persistence;

public static class ConnectionStrings
{
    /// <summary>
    /// Accepts both Npgsql key-value strings and the URL form most hosts hand out
    /// (Neon, Render, Supabase, Railway: <c>postgresql://user:pass@host:5432/db?sslmode=require</c>),
    /// so the value can be pasted as-is into <c>ConnectionStrings__Default</c>.
    /// </summary>
    public static string NormalizePostgres(string value)
    {
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return value;

        var uri = new Uri(value);
        var userInfo = uri.UserInfo.Split(':', 2);
        var parts = new List<string>
        {
            $"Host={uri.Host}",
            $"Port={(uri.Port > 0 ? uri.Port : 5432)}",
            $"Database={Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'))}",
            $"Username={Uri.UnescapeDataString(userInfo[0])}",
        };
        if (userInfo.Length > 1) parts.Add($"Password={Uri.UnescapeDataString(userInfo[1])}");

        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var sslMode = query["sslmode"];
        // Managed providers require TLS; default to it unless the URL says otherwise.
        parts.Add($"SSL Mode={(string.IsNullOrEmpty(sslMode) ? "Require" : sslMode)}");
        return string.Join(';', parts);
    }
}
