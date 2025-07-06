import React from 'react';
import { PQRecord, DashboardStats } from '../types';
import { Package, Clock, CheckCircle, TrendingUp, Activity, Award } from 'lucide-react';

interface DashboardProps {
  records: PQRecord[];
  onFilterClick?: (filterType: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ records, onFilterClick }) => {
  const stats: DashboardStats = React.useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Filter records for current month
    const thisMonthRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });
    
    // Calculate pending PQ certificates (all scenarios except complete)
    const pending_pq = records.filter(record => {
      const shippingBill = record.shipping_bill_received;
      const pqStatus = record.pq_status;
      const permitStatus = record.permit_copy_status;
      
      // Complete scenario: Shipping Bill = Yes, PQ Status = Received, Permit = Received OR Not Required
      const isComplete = shippingBill === true && 
                        pqStatus === 'Received' && 
                        (permitStatus === 'Received' || permitStatus === 'Not Required');
      
      // If not complete, it's pending
      return !isComplete;
    }).length;
    
    // Calculate certificates received (only complete records)
    const certificates_received = records.filter(record => {
      const shippingBill = record.shipping_bill_received;
      const pqStatus = record.pq_status;
      const permitStatus = record.permit_copy_status;
      
      // Complete scenario: Shipping Bill = Yes, PQ Status = Received, Permit = Received OR Not Required
      return shippingBill === true && 
             pqStatus === 'Received' && 
             (permitStatus === 'Received' || permitStatus === 'Not Required');
    }).length;
    
    // Calculate PQ Hardcopy Missing
    const pq_hardcopy_missing = records.filter(record => {
      return !record.pq_hardcopy;
    }).length;
    
    return {
      total_containers: thisMonthRecords.length,
      pending_pq: pending_pq,
      certificates_received: certificates_received,
      pq_hardcopy_missing: pq_hardcopy_missing,
      delays_over_48_hours: 0 // Not used anymore but keeping for type compatibility
    };
  }, [records]);

  const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    gradient: string;
    clickable?: boolean;
    onClick?: () => void;
    trend?: string;
  }> = ({ title, value, icon, gradient, clickable = false, onClick, trend }) => (
    <div 
      className={`group relative overflow-hidden rounded-3xl p-8 transition-all duration-500 transform hover:scale-105 ${
        clickable 
          ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-2' 
          : 'hover:shadow-xl hover:-translate-y-1'
      }`}
      onClick={clickable ? onClick : undefined}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`}></div>
      
      {/* Animated Background Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12 group-hover:scale-125 transition-transform duration-500"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl group-hover:bg-white/30 transition-colors duration-300">
            <div className="text-white group-hover:scale-110 transition-transform duration-300">
              {icon}
            </div>
          </div>
          {trend && (
            <div className="flex items-center space-x-1 text-white/80 text-sm">
              <TrendingUp size={14} />
              <span>{trend}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white/90 text-sm font-medium leading-tight">{title}</h3>
          <div className="flex items-end space-x-2">
            <p className="text-white text-4xl font-bold leading-none">{value}</p>
            {clickable && (
              <div className="text-white/60 text-xs mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Click to view
              </div>
            )}
          </div>
        </div>
        
        {/* Hover Effect Indicator */}
        {clickable && (
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Live Dashboard</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
          Dashboard Overview
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Track your PQ certification status and performance metrics with real-time insights
        </p>
      </div>

      {/* Stats Grid - 4 columns now */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard
          title="Total Containers This Month"
          value={stats.total_containers}
          icon={<Package size={28} />}
          gradient="from-blue-500 via-blue-600 to-indigo-700"
          trend="+12%"
        />
        <StatCard
          title="Pending PQ Certificates"
          value={stats.pending_pq}
          icon={<Clock size={28} />}
          gradient="from-red-500 via-rose-600 to-pink-700"
          clickable={true}
          onClick={() => onFilterClick?.('pending_pq')}
          trend="Urgent"
        />
        <StatCard
          title="Certificates Received"
          value={stats.certificates_received}
          icon={<CheckCircle size={28} />}
          gradient="from-green-500 via-emerald-600 to-teal-700"
          trend="+8%"
        />
        <StatCard
          title="PQ Hardcopy Missing"
          value={stats.pq_hardcopy_missing}
          icon={<Award size={28} />}
          gradient="from-orange-500 via-amber-600 to-yellow-700"
          clickable={true}
          onClick={() => onFilterClick?.('pq_hardcopy_missing')}
          trend="Action Required"
        />
      </div>
    </div>
  );
};

export default Dashboard;