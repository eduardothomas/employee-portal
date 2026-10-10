using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Employees;

public enum Role
{
    Employee = 0,
    Manager = 1,
    HrAdmin = 2
}

public enum EmploymentType
{
    FullTime = 0,
    PartTime = 1,
    Contractor = 2
}

public class Employee : Entity
{
    public string EmployeeCode { get; set; } = "";

    // Identity
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string? PreferredName { get; set; }
    public string NationalId { get; set; } = "";
    public DateOnly? BirthDate { get; set; }
    public string? PhotoUrl { get; set; }

    // Contact (employee-editable)
    public string WorkEmail { get; set; } = "";
    public string? PersonalEmail { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelationship { get; set; }

    // Employment (HR-managed)
    public string JobTitle { get; set; } = "";
    public string Department { get; set; } = "";
    public DateOnly HireDate { get; set; }
    public EmploymentType EmploymentType { get; set; } = EmploymentType.FullTime;
    public Guid? ManagerId { get; set; }
    public Employee? Manager { get; set; }
    public decimal MonthlySalary { get; set; }
    public bool IsActive { get; set; } = true;

    // Banking (HR-managed)
    public string? BankName { get; set; }
    public string? BankAccountType { get; set; }
    public string? BankAccountNumber { get; set; }

    // Time off
    /// <summary>Total vacation days earned to date (Panamá: 30 days per 11 months worked).</summary>
    public decimal VacationAccruedDays { get; set; }

    // Security
    public Role Role { get; set; } = Role.Employee;
    public string PasswordHash { get; set; } = "";
    public bool BiometricEnabled { get; set; }

    public List<RecurringDeduction> RecurringDeductions { get; set; } = [];

    public string DisplayName => string.IsNullOrWhiteSpace(PreferredName) ? FirstName : PreferredName!;
    public string FullName => $"{FirstName} {LastName}";

    public string? MaskedBankAccount =>
        string.IsNullOrEmpty(BankAccountNumber) ? null
        : BankAccountNumber.Length <= 4 ? BankAccountNumber
        : $"•••• {BankAccountNumber[^4..]}";
}

/// <summary>Fixed deduction applied every regular pay period (insurance, loans, etc).</summary>
public class RecurringDeduction : Entity
{
    public Guid EmployeeId { get; set; }
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal AmountPerPeriod { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Request to change a field the employee cannot edit directly (salary, title, bank account...).
/// </summary>
public class ChangeRequest : ReviewableRequest
{
    public string Field { get; set; } = "";
    public string? CurrentValue { get; set; }
    public string RequestedValue { get; set; } = "";
    public string? Reason { get; set; }
}
