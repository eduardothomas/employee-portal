namespace EmployeePortal.Application.Common;

public abstract class AppException(string message) : Exception(message);

public sealed class NotFoundException(string message = "Recurso no encontrado.") : AppException(message);

public sealed class ForbiddenException(string message = "No tienes permiso para realizar esta acción.") : AppException(message);

public sealed class UnauthorizedException(string message = "Credenciales inválidas.") : AppException(message);

public sealed class ValidationException(IDictionary<string, string[]> errors)
    : AppException("Uno o más campos no son válidos.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;

    public static ValidationException For(string field, string message) => new(new Dictionary<string, string[]> { [field] = [message] });
}

public sealed class Validator
{
    private readonly Dictionary<string, List<string>> _errors = [];

    public Validator Require(string? value, string field, string message = "Este campo es obligatorio.")
    {
        if (string.IsNullOrWhiteSpace(value)) Add(field, message);
        return this;
    }

    public Validator MaxLength(string? value, int max, string field)
    {
        if (value is not null && value.Length > max) Add(field, $"Máximo {max} caracteres.");
        return this;
    }

    public Validator Email(string? value, string field)
    {
        if (!string.IsNullOrWhiteSpace(value) && (!value.Contains('@') || value.Length > 200))
            Add(field, "Email inválido.");
        return this;
    }

    public Validator When(bool condition, string field, string message)
    {
        if (condition) Add(field, message);
        return this;
    }

    public void Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list)) _errors[field] = list = [];
        list.Add(message);
    }

    public void ThrowIfInvalid()
    {
        if (_errors.Count > 0)
            throw new ValidationException(_errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()));
    }
}
