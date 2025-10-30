
export const roundCurrency = (n: number | string): number => {
    return Math.round((Number(n) || 0) * 100) / 100;
};

export const formatDate = (dateString?: string | null): string => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return 'N/A';
    }
    try {
        const [year, month, day] = dateString.split('-');
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
    } catch (e) {
        return 'Invalid Date';
    }
};

export const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};
