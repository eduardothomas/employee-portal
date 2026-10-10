namespace EmployeePortal.Domain.Time;

public sealed record Holiday(DateOnly Date, string Name);

/// <summary>Panamanian national holidays and working-day arithmetic.</summary>
public static class WorkCalendar
{
    /// <summary>Panamá: 30 calendar days of vacation for every 11 months of continuous work.</summary>
    public const decimal VacationDaysPerMonth = 30m / 11m;

    public static IReadOnlyList<Holiday> PanamaHolidays(int year)
    {
        var easter = EasterSunday(year);
        var list = new List<Holiday>
        {
            new(new DateOnly(year, 1, 1), "Año Nuevo"),
            new(new DateOnly(year, 1, 9), "Día de los Mártires"),
            new(easter.AddDays(-48), "Carnaval"),
            new(easter.AddDays(-47), "Carnaval"),
            new(easter.AddDays(-2), "Viernes Santo"),
            new(new DateOnly(year, 5, 1), "Día del Trabajo"),
            new(new DateOnly(year, 11, 3), "Separación de Colombia"),
            new(new DateOnly(year, 11, 5), "Día de Colón"),
            new(new DateOnly(year, 11, 10), "Grito de La Villa"),
            new(new DateOnly(year, 11, 28), "Independencia de España"),
            new(new DateOnly(year, 12, 8), "Día de las Madres"),
            new(new DateOnly(year, 12, 20), "Día de Duelo Nacional"),
            new(new DateOnly(year, 12, 25), "Navidad"),
        };

        // Holidays falling on Sunday are observed the following Monday.
        return list
            .Select(h => h.Date.DayOfWeek == DayOfWeek.Sunday ? h with { Date = h.Date.AddDays(1) } : h)
            .OrderBy(h => h.Date)
            .ToList();
    }

    public static bool IsHoliday(DateOnly date) => PanamaHolidays(date.Year).Any(h => h.Date == date);

    public static bool IsWorkingDay(DateOnly date) =>
        date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && !IsHoliday(date);

    /// <summary>Number of working days between two dates, inclusive.</summary>
    public static int WorkingDays(DateOnly from, DateOnly to)
    {
        if (to < from) return 0;
        var count = 0;
        for (var d = from; d <= to; d = d.AddDays(1))
            if (IsWorkingDay(d)) count++;
        return count;
    }

    public static decimal AccruedVacationDays(DateOnly hireDate, DateOnly asOf)
    {
        if (asOf < hireDate) return 0m;
        var months = (asOf.Year - hireDate.Year) * 12 + asOf.Month - hireDate.Month;
        if (asOf.Day < hireDate.Day) months--;
        return Math.Round(Math.Max(0, months) * VacationDaysPerMonth, 1);
    }

    // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
    public static DateOnly EasterSunday(int year)
    {
        int a = year % 19, b = year / 100, c = year % 100, d = b / 4, e = b % 4;
        int f = (b + 8) / 25, g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31, day = (h + l - 7 * m + 114) % 31 + 1;
        return new DateOnly(year, month, day);
    }
}
