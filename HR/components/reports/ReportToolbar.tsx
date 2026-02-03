import React from 'react';

interface ExportHeader {
    label: string;
    key: string;
}

interface ReportToolbarProps {
    title: string;
    exportData: any[];
    exportHeaders: ExportHeader[];
    exportFilename: string;
}

const ReportToolbar: React.FC<ReportToolbarProps> = ({ title, exportData, exportHeaders, exportFilename }) => {
    const handlePrint = () => {
        window.print();
    };

    const handleExportCsv = () => {
        if (exportData.length === 0) {
            alert("No data to export.");
            return;
        }

        const csvRows = [];
        const headers = exportHeaders.map(h => h.label);
        csvRows.push(headers.join(','));

        for (const row of exportData) {
            const values = exportHeaders.map(header => {
                const val = row[header.key] === null || row[header.key] === undefined ? '' : row[header.key];
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${exportFilename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex justify-between items-center mb-4 no-print">
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            <div className="flex items-center space-x-2">
                <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                    Print
                </button>
                <button
                    onClick={handleExportCsv}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                    Export to Excel (CSV)
                </button>
            </div>
        </div>
    );
};

export default ReportToolbar;
