using EmployeePortal.Infrastructure.Persistence;

namespace EmployeePortal.Tests;

public class ConnectionStringTests
{
    [Fact]
    public void Url_from_hosting_provider_is_converted()
    {
        var result = ConnectionStrings.NormalizePostgres(
            "postgresql://portal:p%40ss@ep-cool-name.us-east-2.aws.neon.tech/employee_portal?sslmode=require");

        Assert.Equal("Host=ep-cool-name.us-east-2.aws.neon.tech;Port=5432;Database=employee_portal;Username=portal;Password=p@ss;SSL Mode=require", result);
    }

    [Fact]
    public void Key_value_string_is_left_untouched()
    {
        const string cs = "Host=localhost;Database=x;Username=u;Password=p";
        Assert.Equal(cs, ConnectionStrings.NormalizePostgres(cs));
    }
}
