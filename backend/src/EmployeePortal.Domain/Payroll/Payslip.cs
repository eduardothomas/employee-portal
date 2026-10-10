using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Payroll;

public enum PayslipKind
{
    Regular = 0,
    Decimo = 1
}

public enum PayslipLineType
{
    Earning = 0,
    Deduction = 1
}

public enum PayrollRunStatus
{
    Draft = 0,
    Published = 1
}

public class PayrollRun : Entity
{
    public PayslipKind Kind { get; set; } = PayslipKind.Regular;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateOnly PayDate { get; set; }
    public PayrollRunStatus Status { get; set; } = PayrollRunStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
    public DateTime? PublishedAt { get; set; }
    public List<Payslip> Payslips { get; set; } = [];
}

public class Payslip : Entity
{
    public Guid EmployeeId { get; set; }
    public Guid? PayrollRunId { get; set; }
    public PayslipKind Kind { get; set; } = PayslipKind.Regular;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateOnly PayDate { get; set; }
    public bool IsPublished { get; set; } = true;
    public List<PayslipLine> Lines { get; set; } = [];

    public decimal Gross => Lines.Where(l => l.Type == PayslipLineType.Earning).Sum(l => l.Amount);
    public decimal TotalDeductions => Lines.Where(l => l.Type == PayslipLineType.Deduction).Sum(l => l.Amount);
    public decimal Net => Gross - TotalDeductions;

    public string Number => $"{(Kind == PayslipKind.Decimo ? "DEC" : "PAY")}-{PayDate:yyyyMMdd}";
}

public class PayslipLine : Entity
{
    public Guid PayslipId { get; set; }
    public PayslipLineType Type { get; set; }
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Amount { get; set; }
    public int SortOrder { get; set; }
}
