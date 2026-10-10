namespace EmployeePortal.Contracts;

public sealed record PayslipLineDto(string Code, string Description, decimal Amount);

public sealed record PayslipSummaryDto(
    Guid Id,
    string Number,
    string Kind,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    DateOnly PayDate,
    decimal Gross,
    decimal Deductions,
    decimal Net);

public sealed record PayslipDetailDto(
    PayslipSummaryDto Summary,
    IReadOnlyList<PayslipLineDto> Earnings,
    IReadOnlyList<PayslipLineDto> DeductionLines,
    string EmployeeName,
    string EmployeeCode,
    string JobTitle);

public sealed record MonthlyNetDto(int Year, int Month, decimal Gross, decimal Deductions, decimal Net);

public sealed record PayrollSummaryResponse(
    decimal MonthlySalary,
    DateOnly NextPayDate,
    decimal NextPayEstimatedNet,
    PayslipSummaryDto? LatestPayslip,
    IReadOnlyList<MonthlyNetDto> History);

/// <summary>Both quincenas of a month aggregated (the "Agosto 2026" salary breakdown).</summary>
public sealed record MonthDetailDto(
    int Year,
    int Month,
    IReadOnlyList<PayslipLineDto> Earnings,
    IReadOnlyList<PayslipLineDto> DeductionLines,
    decimal Gross,
    decimal Deductions,
    decimal Net,
    IReadOnlyList<PayslipSummaryDto> Payslips);

public sealed record DeductionMonthDto(int Year, int Month, decimal Total, IReadOnlyDictionary<string, decimal> ByCode);

public sealed record DeductionsResponse(
    int Year,
    int Month,
    IReadOnlyList<PayslipLineDto> Items,
    decimal Total,
    IReadOnlyList<PayslipLineDto> YearToDate,
    IReadOnlyList<DeductionMonthDto> History);

public sealed record DecimoResponse(
    DateOnly NextPayDate,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal EstimatedGross,
    decimal EstimatedNet,
    IReadOnlyList<PayslipSummaryDto> History);
