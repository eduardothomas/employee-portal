using EmployeePortal.Application.Common;
using EmployeePortal.Domain.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace EmployeePortal.Api.Infrastructure;

/// <summary>Maps application exceptions to RFC 7807 problem details.</summary>
public sealed class AppExceptionHandler(IProblemDetailsService problemDetails, ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            DomainException => (StatusCodes.Status400BadRequest, exception.Message),
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ForbiddenException => (StatusCodes.Status403Forbidden, exception.Message),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, exception.Message),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "No autenticado."),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "Solicitud inválida."),
            _ => (StatusCodes.Status500InternalServerError, "Ocurrió un error inesperado.")
        };

        if (status == 500) logger.LogError(exception, "Unhandled exception");

        var problem = new ProblemDetails { Status = status, Title = title };
        if (exception is ValidationException v) problem.Extensions["errors"] = v.Errors;

        context.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem, Exception = exception });
    }
}
