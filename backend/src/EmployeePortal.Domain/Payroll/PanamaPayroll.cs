namespace EmployeePortal.Domain.Payroll;

public sealed record PayrollLine(PayslipLineType Type, string Code, string Description, decimal Amount);

public sealed record ExtraDeduction(string Code, string Description, decimal Amount);

/// <summary>
/// Simplified Panamanian payroll rules for a bi-weekly (quincenal) pay cycle.
/// Rates are centralised here so HR policy changes are a one-line edit.
/// </summary>
public static class PanamaPayroll
{
    public const decimal CssEmployeeRate = 0.0975m;        // Caja de Seguro Social
    public const decimal EducationInsuranceRate = 0.0125m; // Seguro Educativo
    public const decimal DecimoCssRate = 0.0725m;          // CSS on décimo tercer mes

    public const decimal IsrExemptThreshold = 11_000m;
    public const decimal IsrSecondBracket = 50_000m;

    /// <summary>Annual income tax (ISR) on salary income.</summary>
    public static decimal AnnualIncomeTax(decimal annualIncome)
    {
        if (annualIncome <= IsrExemptThreshold) return 0m;
        if (annualIncome <= IsrSecondBracket) return (annualIncome - IsrExemptThreshold) * 0.15m;
        return 5_850m + (annualIncome - IsrSecondBracket) * 0.25m;
    }

    /// <summary>
    /// Builds the lines of a regular quincena. ISR is withheld by projecting
    /// the monthly salary over 13 months (12 + décimo) and spreading it over 26 payments.
    /// </summary>
    public static IReadOnlyList<PayrollLine> CalculateRegular(
        decimal monthlySalary,
        decimal bonus = 0m,
        decimal overtime = 0m,
        IEnumerable<ExtraDeduction>? extraDeductions = null)
    {
        var lines = new List<PayrollLine>();
        var basePay = Round(monthlySalary / 2m);
        lines.Add(new(PayslipLineType.Earning, "BASE", "Salario base", basePay));
        if (bonus > 0) lines.Add(new(PayslipLineType.Earning, "BONUS", "Bonificación", Round(bonus)));
        if (overtime > 0) lines.Add(new(PayslipLineType.Earning, "OT", "Horas extra", Round(overtime)));

        var gross = lines.Sum(l => l.Amount);
        lines.Add(new(PayslipLineType.Deduction, "CSS", "CSS", Round(gross * CssEmployeeRate)));
        lines.Add(new(PayslipLineType.Deduction, "SE", "Seguro Educativo", Round(gross * EducationInsuranceRate)));

        var projectedAnnual = monthlySalary * 13m + (bonus + overtime) * 2m;
        var isr = Round(AnnualIncomeTax(projectedAnnual) / 26m);
        if (isr > 0) lines.Add(new(PayslipLineType.Deduction, "ISR", "ISR", isr));

        foreach (var extra in extraDeductions ?? [])
            lines.Add(new(PayslipLineType.Deduction, extra.Code, extra.Description, Round(extra.Amount)));

        return lines;
    }

    /// <summary>Lines for a décimo tercer mes payment given gross salaries earned in its period.</summary>
    public static IReadOnlyList<PayrollLine> CalculateDecimo(decimal earningsInPeriod)
    {
        var gross = Round(earningsInPeriod / 12m);
        return
        [
            new(PayslipLineType.Earning, "DECIMO", "Décimo tercer mes", gross),
            new(PayslipLineType.Deduction, "CSS", "CSS (7.25%)", Round(gross * DecimoCssRate))
        ];
    }

    public static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

/// <summary>Pay dates: the 15th and the last day of each month.</summary>
public static class PayCalendar
{
    public static DateOnly NextPayDate(DateOnly today)
    {
        if (today.Day <= 15) return new DateOnly(today.Year, today.Month, 15);
        return new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));
    }

    /// <summary>The quincena (period start/end) whose pay date is <paramref name="payDate"/>.</summary>
    public static (DateOnly Start, DateOnly End) PeriodFor(DateOnly payDate) =>
        payDate.Day <= 15
            ? (new DateOnly(payDate.Year, payDate.Month, 1), new DateOnly(payDate.Year, payDate.Month, 15))
            : (new DateOnly(payDate.Year, payDate.Month, 16),
               new DateOnly(payDate.Year, payDate.Month, DateTime.DaysInMonth(payDate.Year, payDate.Month)));
}

/// <summary>
/// Décimo tercer mes: paid in three installments (15 Apr, 15 Aug, 15 Dec), each worth
/// 1/12 of the salary earned in its four-month period.
/// </summary>
public static class DecimoCalendar
{
    public sealed record DecimoPeriod(DateOnly Start, DateOnly End, DateOnly PayDate);

    public static DecimoPeriod CurrentPeriod(DateOnly today)
    {
        var y = today.Year;
        var apr = new DateOnly(y, 4, 15);
        var aug = new DateOnly(y, 8, 15);
        var dec = new DateOnly(y, 12, 15);

        if (today <= apr) return new(new DateOnly(y - 1, 12, 16), apr, apr);
        if (today <= aug) return new(new DateOnly(y, 4, 16), aug, aug);
        if (today <= dec) return new(new DateOnly(y, 8, 16), dec, dec);
        return new(new DateOnly(y, 12, 16), new DateOnly(y + 1, 4, 15), new DateOnly(y + 1, 4, 15));
    }

    /// <summary>Estimate of the gross installment assuming the current salary for the whole period.</summary>
    public static decimal EstimateGross(decimal monthlySalary, DecimoPeriod period, DateOnly hireDate)
    {
        var start = hireDate > period.Start ? hireDate : period.Start;
        if (start > period.End) return 0m;
        var days = period.End.DayNumber - start.DayNumber + 1;
        var periodDays = period.End.DayNumber - period.Start.DayNumber + 1;
        var earnings = monthlySalary * 4m * days / periodDays;
        return PanamaPayroll.Round(earnings / 12m);
    }
}
