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
        return 'bg-blue-50 text-blue-600';
      case 'green':
        return 'bg-green-50 text-green-600';
      case 'yellow':
        return 'bg-yellow-50 text-yellow-600';
      case 'red':
        return 'bg-red-50 text-red-600';
      case 'purple':
        return 'bg-purple-50 text-purple-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow-sm rounded-lg border">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses(color)}`}>
            <span className="text-xl">{icon}</span>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-2xl font-semibold text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
