import React from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

/**
 * StatusBadge Component
 * Displays a visual indicator for invitation status.
 * @param {string} status - Values: 'pending', 'accepted', 'rejected', 'uncertain'
 */
const StatusBadge = ({ status }) => {
    const config = {
        accepted: {
            label: 'Aceito',
            icon: CheckCircle,
            styles: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        },
        rejected: {
            label: 'Recusado',
            icon: XCircle,
            styles: 'bg-red-100 text-red-700 border-red-200',
        },
        pending: {
            label: 'Pendente',
            icon: Clock,
            styles: 'bg-amber-100 text-amber-700 border-amber-200',
        },
        uncertain: {
            label: 'Incerto',
            icon: AlertCircle,
            styles: 'bg-gray-100 text-gray-700 border-gray-200',
        }
    };

    // Default to pending if status is unknown or missing
    const current = config[status?.toLowerCase()] || config.pending;
    const Icon = current.icon;

    return (
        <span className={clsx(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-sm transition-all duration-300",
            current.styles
        )}>
            <Icon size={12} className="shrink-0" />
            {current.label}
        </span>
    );
};

export default StatusBadge;
