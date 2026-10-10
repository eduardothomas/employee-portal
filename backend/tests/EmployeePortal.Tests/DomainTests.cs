using EmployeePortal.Application.Common;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Time;

namespace EmployeePortal.Tests;

public class PanamaPayrollTests
{
    [Theory]
    [InlineData(10_000, 0)]
    [InlineData(11_000, 0)]
    [InlineData(45_500, 5_175)]
    [InlineData(50_000, 5_850)]
    [InlineData(60_000, 8_350)]
    public void AnnualIncomeTax_follows_brackets(decimal income, decimal expected) =>
        Assert.Equal(expected, PanamaPayroll.AnnualIncomeTax(income));

    [Fact]
    public void Regular_quincena_for_3500_monthly()
    {
        var lines = PanamaPayroll.CalculateRegular(3500m);
        decimal Get(string code) => lines.Single(l => l.Code == code).Amount;

        Assert.Equal(1750m, Get("BASE"));
        Assert.Equal(170.63m, Get("CSS"));
        Assert.Equal(21.88m, Get("SE"));
        Assert.Equal(199.04m, Get("ISR")); // (3500*13 - 11000) * 15% / 26
    }

    [Fact]
    public void Low_salary_has_no_isr()
    {
        var lines = PanamaPayroll.CalculateRegular(800m);
        Assert.DoesNotContain(lines, l => l.Code == "ISR");
    }

    [Fact]
    public void Extra_deductions_are_appended()
    {
        var lines = PanamaPayroll.CalculateRegular(2000m, extraDeductions: [new ExtraDeduction("LOAN", "Préstamo", 100m)]);
        Assert.Contains(lines, l => l is { Code: "LOAN", Amount: 100m, Type: PayslipLineType.Deduction });
    }

    [Fact]
    public void Decimo_is_one_twelfth_minus_css()
    {
        var lines = PanamaPayroll.CalculateDecimo(14_000m);
        Assert.Equal(1166.67m, lines.Single(l => l.Code == "DECIMO").Amount);
        Assert.Equal(84.58m, lines.Single(l => l.Code == "CSS").Amount);
    }
}

public class CalendarTests
{
    [Theory]
    [InlineData("2026-10-09", "2026-10-15")]
    [InlineData("2026-10-15", "2026-10-15")]
    [InlineData("2026-10-16", "2026-10-31")]
    [InlineData("2026-02-20", "2026-02-28")]
    public void NextPayDate(string today, string expected) =>
        Assert.Equal(DateOnly.Parse(expected), PayCalendar.NextPayDate(DateOnly.Parse(today)));

    [Theory]
    [InlineData("2026-01-10", "2025-12-16", "2026-04-15")]
    [InlineData("2026-05-01", "2026-04-16", "2026-08-15")]
    [InlineData("2026-10-09", "2026-08-16", "2026-12-15")]
    [InlineData("2026-12-20", "2026-12-16", "2027-04-15")]
    public void Decimo_period(string today, string start, string pay)
    {
        var p = DecimoCalendar.CurrentPeriod(DateOnly.Parse(today));
        Assert.Equal(DateOnly.Parse(start), p.Start);
        Assert.Equal(DateOnly.Parse(pay), p.PayDate);
    }

    [Fact]
    public void Easter_2026_is_april_5() => Assert.Equal(new DateOnly(2026, 4, 5), WorkCalendar.EasterSunday(2026));

    [Fact]
    public void Working_days_skip_weekends_and_holidays()
    {
        // 2–13 Nov 2026: 10 weekdays minus 3, 5 and 10 Nov holidays.
        Assert.Equal(7, WorkCalendar.WorkingDays(new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 13)));
    }

    [Fact]
    public void Sunday_holiday_moves_to_monday()
    {
        // 20 Dec 2026 is a Sunday → observed Monday 21.
        Assert.True(WorkCalendar.IsHoliday(new DateOnly(2026, 12, 21)));
        Assert.False(WorkCalendar.IsHoliday(new DateOnly(2026, 12, 20)));
    }

    [Fact]
    public void Vacation_accrual_is_30_days_per_11_months() =>
        Assert.Equal(30m, WorkCalendar.AccruedVacationDays(new DateOnly(2025, 1, 1), new DateOnly(2025, 12, 1)));
}

public class RequestTests
{
    private sealed class TestRequest : ReviewableRequest;

    [Fact]
    public void Cannot_approve_own_request()
    {
        var id = Guid.NewGuid();
        var r = new TestRequest { EmployeeId = id };
        Assert.Throws<DomainException>(() => r.Approve(id, null, DateTime.UtcNow));
    }

    [Fact]
    public void Cannot_decide_twice()
    {
        var r = new TestRequest { EmployeeId = Guid.NewGuid() };
        r.Approve(Guid.NewGuid(), "ok", DateTime.UtcNow);
        Assert.Equal(RequestStatus.Approved, r.Status);
        Assert.Throws<DomainException>(() => r.Reject(Guid.NewGuid(), null, DateTime.UtcNow));
    }

    [Fact]
    public void Next_number_is_sequential_per_year()
    {
        Assert.Equal("VAC-2026-00101", QueryHelpers.NextNumber([], "VAC", 2026));
        Assert.Equal("VAC-2026-00143", QueryHelpers.NextNumber(["VAC-2026-00142", "VAC-2025-00900"], "VAC", 2026));
    }
}
