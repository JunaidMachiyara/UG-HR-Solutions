import React from 'react';

interface ReportFiltersProps {
    filters: {
        startDate: string;
        endDate: string;
        [key: string]: any;
    };
    onFilterChange: (filterName: string, value: any) => void;
    children?: React.ReactNode;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({ filters, onFilterChange, children }) => {
    return (
        <div className="p-4 bg-slate-50 rounded-lg border mb-6 flex flex-wrap gap-4 items-end no-print">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => onFilterChange('startDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => onFilterChange('endDate', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                />
            </div>
            {children}
        </div>
    );
};

export default ReportFilters;
