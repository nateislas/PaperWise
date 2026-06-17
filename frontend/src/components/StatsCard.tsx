import React from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-primary-50 text-primary-600 border-primary-100';
      case 'green':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'yellow':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'red':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'purple':
        return 'bg-violet-50 text-violet-600 border-violet-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-soft rounded-2xl border border-slate-100 transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-1">
      <div className="p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${getColorClasses(color)}`}>
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</dt>
              <dd className="text-3xl font-bold text-slate-900 leading-none">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
