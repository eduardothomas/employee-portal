using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Employees;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

public sealed class ProfileService(IAppDbContext db, ICurrentUser user, AuditTrail audit)
{
    /// <summary>Fields that can only change through an HR-approved change request.</summary>
    public static readonly IReadOnlyDictionary<string, string> RestrictedFields = new Dictionary<string, string>
    {
        ["firstName"] = "Nombre",
        ["lastName"] = "Apellido",
        ["jobTitle"] = "Cargo",
        ["department"] = "Departamento",
        ["monthlySalary"] = "Salario",
        ["hireDate"] = "Fecha de ingreso",
        ["manager"] = "Supervisor",
        ["bankAccount"] = "Cuenta bancaria",
        ["nationalId"] = "Cédula",
    };

    public async Task<MeResponse> GetMeAsync(CancellationToken ct)
    {
        var e = await db.Employees.Include(x => x.Manager).FirstOrDefaultAsync(x => x.Id == user.Id, ct)
            ?? throw new NotFoundException();
        var unread = await db.Notifications.CountAsync(n => n.EmployeeId == e.Id && n.ReadAt == null, ct);

        return new MeResponse(
            e.Id, e.DisplayName, e.FullName, e.Role.ToApi(), e.PhotoUrl,
            new PersonalInfoDto(e.FirstName, e.LastName, e.PreferredName, Mapping.MaskNationalId(e.NationalId), e.BirthDate,
                e.PersonalEmail, e.Phone, e.Address, e.EmergencyContactName, e.EmergencyContactPhone,
                e.EmergencyContactRelationship, e.PhotoUrl),
            new EmploymentInfoDto(e.EmployeeCode, e.JobTitle, e.Department, e.HireDate, e.EmploymentType.ToApi(),
                e.Manager?.FullName, e.MonthlySalary, e.WorkEmail),
            new BankInfoDto(e.BankName, e.BankAccountType, e.MaskedBankAccount),
            e.BiometricEnabled,
            unread);
    }

    public async Task<MeResponse> UpdateProfileAsync(UpdateProfileRequest r, CancellationToken ct)
    {
        new Validator()
            .MaxLength(r.PreferredName, 60, "preferredName")
            .Email(r.PersonalEmail, "personalEmail")
            .MaxLength(r.Phone, 30, "phone")
            .MaxLength(r.Address, 300, "address")
            .MaxLength(r.EmergencyContactName, 120, "emergencyContactName")
            .MaxLength(r.EmergencyContactPhone, 30, "emergencyContactPhone")
            .MaxLength(r.EmergencyContactRelationship, 60, "emergencyContactRelationship")
            .MaxLength(r.PhotoUrl, 300_000, "photoUrl")
            .ThrowIfInvalid();

        var e = await db.GetEmployeeAsync(user.Id, ct);
        var changes = new List<string>();

        void Set(string? value, Func<string?> get, Action<string?> set, string name)
        {
            if (value is null) return;
            var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
            if (normalized == get()) return;
            set(normalized);
            changes.Add(name);
        }

        Set(r.PreferredName, () => e.PreferredName, v => e.PreferredName = v, "preferredName");
        Set(r.PersonalEmail, () => e.PersonalEmail, v => e.PersonalEmail = v, "personalEmail");
        Set(r.Phone, () => e.Phone, v => e.Phone = v, "phone");
        Set(r.Address, () => e.Address, v => e.Address = v, "address");
        Set(r.EmergencyContactName, () => e.EmergencyContactName, v => e.EmergencyContactName = v, "emergencyContactName");
        Set(r.EmergencyContactPhone, () => e.EmergencyContactPhone, v => e.EmergencyContactPhone = v, "emergencyContactPhone");
        Set(r.EmergencyContactRelationship, () => e.EmergencyContactRelationship, v => e.EmergencyContactRelationship = v, "emergencyContactRelationship");
        Set(r.PhotoUrl, () => e.PhotoUrl, v => e.PhotoUrl = v, "photo");

        if (changes.Count > 0)
        {
            audit.Record(AuditActions.ProfileUpdated, nameof(Employee), e.Id, e.Id, new { fields = changes });
            await db.SaveChangesAsync(ct);
        }
        return await GetMeAsync(ct);
    }

    public async Task UpdateSecurityAsync(UpdateSecurityRequest r, CancellationToken ct)
    {
        var e = await db.GetEmployeeAsync(user.Id, ct);
        e.BiometricEnabled = r.BiometricEnabled;
        audit.Record("security.biometric_" + (r.BiometricEnabled ? "enabled" : "disabled"), nameof(Employee), e.Id, e.Id);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ChangeRequestDto> CreateChangeRequestAsync(CreateChangeRequest r, CancellationToken ct)
    {
        new Validator()
            .When(!RestrictedFields.ContainsKey(r.Field ?? ""), "field", "Campo no válido para solicitud de cambio.")
            .Require(r.RequestedValue, "requestedValue")
            .MaxLength(r.RequestedValue, 300, "requestedValue")
            .MaxLength(r.Reason, 1000, "reason")
            .ThrowIfInvalid();

        var e = await db.Employees.Include(x => x.Manager).FirstAsync(x => x.Id == user.Id, ct);
        var hasPending = await db.ChangeRequests.AnyAsync(c => c.EmployeeId == e.Id && c.Field == r.Field && c.Status == Domain.Common.RequestStatus.Pending, ct);
        if (hasPending) throw ValidationException.For("field", "Ya tienes una solicitud pendiente para este campo.");

        var request = new ChangeRequest
        {
            EmployeeId = e.Id,
            Field = r.Field!,
            CurrentValue = CurrentValue(e, r.Field!),
            RequestedValue = r.RequestedValue.Trim(),
            Reason = r.Reason?.Trim()
        };
        db.ChangeRequests.Add(request);
        audit.Record(AuditActions.ChangeRequested, nameof(ChangeRequest), request.Id, e.Id, new { r.Field });
        await db.SaveChangesAsync(ct);
        return request.ToDto(new Dictionary<Guid, string> { [e.Id] = e.FullName });
    }

    public async Task<IReadOnlyList<ChangeRequestDto>> GetMyChangeRequestsAsync(CancellationToken ct)
    {
        var list = await db.ChangeRequests.Where(c => c.EmployeeId == user.Id).OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        var names = await db.NamesAsync(list, ct);
        return list.Select(c => c.ToDto(names)).ToList();
    }

    public static string? CurrentValue(Employee e, string field) => field switch
    {
        "firstName" => e.FirstName,
        "lastName" => e.LastName,
        "jobTitle" => e.JobTitle,
        "department" => e.Department,
        "monthlySalary" => e.MonthlySalary.ToString("0.00"),
        "hireDate" => e.HireDate.ToString("yyyy-MM-dd"),
        "manager" => e.Manager?.FullName,
        "bankAccount" => e.MaskedBankAccount,
        "nationalId" => Mapping.MaskNationalId(e.NationalId),
        _ => null
    };
}
