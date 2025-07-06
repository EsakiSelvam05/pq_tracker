import React, { useState, useMemo, useEffect } from 'react';
import { PQRecord } from '../types';
import { savePQRecord, deletePQRecord } from '../utils/storage';
import { isDelayed, getHoursElapsed } from '../utils/dateHelpers';
import { exportToExcel, exportToPDF } from '../utils/export';
import { Search, Filter, Download, Edit, Trash2, X, CheckCircle, Clock, Sparkles, Activity, Check, Award, Grid, List } from 'lucide-react';

interface RecordsViewProps {
  records: PQRecord[];
  onEdit: (record: PQRecord) => void;
  onRecordsChange: () => void;
  initialFilter?: {
    pq_status?: string;
    pq_hardcopy?: string;
  };
  onFilterChange?: (filter: {
    pq_status?: string;
    pq_hardcopy?: string;
  }) => void;
}

type FilterOptions = {
  dateRange?: { start: string; end: string };
  pq_status?: string;
  pq_hardcopy?: string;
  shipper_name?: string;
  buyer?: string;
  invoice_number?: string;
  destination_port?: string;
  shipping_bill_received?: boolean;
  permit_copy_status?: string;
};

const RecordsView: React.FC<RecordsViewProps> = ({ 
  records, 
  onEdit, 
  onRecordsChange, 
  initialFilter = {},
  onFilterChange 
}) => {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof PQRecord>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeSection, setActiveSection] = useState<'all' | 'pending' | 'received' | 'hardcopyMissing'>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewMode, setViewMode] = useState<'details' | 'list'>('details');

  // Get unique shipper names for dropdown
  const uniqueShipperNames = useMemo(() => {
    const shipperNames = records
      .map(record => record.shipper_name)
      .filter(name => name && name.trim() !== '')
      .sort();
    
    // Remove duplicates
    return [...new Set(shipperNames)];
  }, [records]);

  useEffect(() => {
    if (initialFilter.pq_status) {
      if (initialFilter.pq_status === 'incomplete') {
        // Show all incomplete records (pending PQ certificates)
        setActiveSection('pending');
        setFilters({}); // Don't set specific pqStatus filter, let the section handle it
      } else if (initialFilter.pq_status === 'Pending') {
        setActiveSection('pending');
        setFilters({ pq_status: initialFilter.pq_status });
      } else if (initialFilter.pq_status === 'Received') {
        setActiveSection('received');
        setFilters({ pq_status: initialFilter.pq_status });
      }
    } else if (initialFilter.pq_hardcopy) {
      if (initialFilter.pq_hardcopy === 'Not Received') {
        setActiveSection('hardcopyMissing');
        setFilters({ pq_hardcopy: initialFilter.pq_hardcopy });
      }
    }
  }, [initialFilter]);

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records.filter(record => {
      const matchesSearch = !searchTerm || 
        Object.values(record).some(value => 
          typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return record[key as keyof PQRecord] === value;
      });

      const matchesDateRange = (!dateRange.start || record.date >= dateRange.start) &&
                              (!dateRange.end || record.date <= dateRange.end);

      let matchesSection = true;
      if (activeSection === 'pending') {
        // Show all incomplete records (same logic as dashboard)
        const shippingBill = record.shipping_bill_received;
        const pqStatus = record.pq_status;
        const permitStatus = record.permit_copy_status;
        
        // Complete scenario: Shipping Bill = Yes, PQ Status = Received, Permit = Received OR Not Required
        const isComplete = shippingBill === true && 
                          pqStatus === 'Received' && 
                          (permitStatus === 'Received' || permitStatus === 'Not Required');
        
        matchesSection = !isComplete; // Show incomplete records
      } else if (activeSection === 'received') {
        // Show only complete records
        const shippingBill = record.shipping_bill_received;
        const pqStatus = record.pq_status;
        const permitStatus = record.permit_copy_status;
        
        matchesSection = shippingBill === true && 
                        pqStatus === 'Received' && 
                        (permitStatus === 'Received' || permitStatus === 'Not Required');
      } else if (activeSection === 'hardcopyMissing') {
        // Show only PQ Hardcopy Missing records
        matchesSection = (record.pq_hardcopy || 'Not Received') === 'Not Received';
      }
      // activeSection === 'all' shows everything

      return matchesSearch && matchesFilters && matchesDateRange && matchesSection;
    });

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Special handling for date sorting to ensure latest entries appear first by default
      if (sortBy === 'created_at' || sortBy === 'date') {
        if (sortBy === 'date') {
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
        }
      }
      
      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * modifier;
      }
      return 0;
    });

    return filtered;
  }, [records, filters, searchTerm, sortBy, sortOrder, activeSection, dateRange]);

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      deletePQRecord(id);
      onRecordsChange();
    }
  };

  const handleMarkCompleted = (record: PQRecord) => {
    if (window.confirm('Mark this PQ as completed? This will set Shipping Bill to "Yes" and PQ Status to "Received".')) {
      const updatedRecord: PQRecord = {
        ...record,
        shipping_bill_received: true,
        pq_status: 'Received'
      };
      
      savePQRecord(updatedRecord);
      onRecordsChange();
    }
  };

  const handleDownloadInvoice = (record: PQRecord) => {
    try {
      // Check if record has uploaded invoice
      if (!record.uploadedInvoice) {
        alert('No invoice file available for download');
        return;
      }


    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error downloading invoice file. Please try again.');
    }
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setActiveSection('all');
    onFilterChange?.({});
  };
  const handleSectionChange = (section: 'all' | 'pending' | 'received' | 'hardcopyMissing') => {
    setActiveSection(section);
    // Clear specific filters when changing sections
    const newFilters = { ...filters };
    delete newFilters.pq_status;
    delete newFilters.pq_hardcopy;
    setFilters(newFilters);
  };

  const getRecordBackgroundColor = (record: PQRecord) => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;

    // PRIORITY 1: If PQ Status is "Pending", always show RED background
    if (pqStatus === 'Pending') {
      return 'bg-gradient-to-br from-red-50 via-rose-50 to-red-100 border-red-300 shadow-red-200/50';
    }

    // PRIORITY 2: Complete records (all requirements met) - GREEN
    if (shippingBill === true && 
        pqStatus === 'Received' && 
        (permitStatus === 'Received' || permitStatus === 'Not Required')) {
      return 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 border-green-300 shadow-green-200/50';
    }

    // PRIORITY 3: Other incomplete scenarios - RED
    if (shippingBill === false ||
        (shippingBill === true && pqStatus === 'Received' && permitStatus === 'Not Received')) {
      return 'bg-gradient-to-br from-red-50 via-rose-50 to-red-100 border-red-300 shadow-red-200/50';
    }

    // FALLBACK: Default blue for any other cases
    return 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 border-blue-300 shadow-blue-200/50';
  };

  const getShippingBillBadge = (status: boolean) => {
    if (status === true) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          Bill ✓
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg">
          Bill ✗
        </span>
      );
    }
  };

  const getPQStatusBadge = (status: string, createdAt: string) => {
    const timestamp = new Date(createdAt).getTime();
    const isDelayedStatus = isDelayed(timestamp, status);
    
    if (status === 'Received') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          PQ ✓
        </span>
      );
    } else if (status === 'Pending') {
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
          isDelayedStatus 
            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg' 
            : 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
        }`}>
          PQ Pending {isDelayedStatus && `(${getHoursElapsed(timestamp)}h)`}
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-gray-500 to-slate-600 text-white shadow-lg">
          PQ: {status}
        </span>
      );
    }
  };

  const getPQHardcopyBadge = (status: string) => {
    if (status === 'Received') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          Hard ✓
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg">
          Hard ✗
        </span>
      );
    }
  };

  const getPermitCopyBadge = (status: string) => {
    if (status === 'Received') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          Permit ✓
        </span>
      );
    } else if (status === 'Not Required') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          Permit N/A
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg">
          Permit ✗
        </span>
      );
    }
  };

  const getRecordStatusIndicator = (record: PQRecord) => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;

    if (shippingBill === true && 
        pqStatus === 'Received' && 
        (permitStatus === 'Received' || permitStatus === 'Not Required')) {
      return (
        <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full shadow-lg">
          <CheckCircle size={14} />
          <span className="text-xs font-semibold">Complete</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg">
        <Clock size={14} />
        <span className="text-xs font-semibold">Pending</span>
      </div>
    );
  };

  const isRecordCompleted = (record: PQRecord) => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;

    return shippingBill === true && 
           pqStatus === 'Received' && 
           (permitStatus === 'Received' || permitStatus === 'Not Required');
  };

  // Calculate counts using the same logic as dashboard
  const pendingCount = records.filter(record => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;
    
    // Complete scenario: Shipping Bill = Yes, PQ Status = Received, Permit = Received OR Not Required
    const isComplete = shippingBill === true && 
                      pqStatus === 'Received' && 
                      (permitStatus === 'Received' || permitStatus === 'Not Required');
    
    return !isComplete; // Count incomplete records as pending
  }).length;

  const receivedCount = records.filter(record => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;
    
    return shippingBill === true && 
           pqStatus === 'Received' && 
           (permitStatus === 'Received' || permitStatus === 'Not Required');
  }).length;

  const hardcopyMissingCount = records.filter(record => {
    return (record.pq_hardcopy || 'Not Received') === 'Not Received';
  }).length;

  const currentSectionCount = filteredAndSortedRecords.length;

  const getSectionButtonStyle = (section: 'all' | 'pending' | 'received' | 'hardcopyMissing') => {
    const isActive = activeSection === section;
    const baseStyle = "relative overflow-hidden px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center space-x-3";
    
    if (section === 'pending') {
      return `${baseStyle} ${isActive 
        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-2xl shadow-red-500/25' 
        : 'bg-red-50 text-red-700 hover:bg-red-100 border-2 border-red-200'}`;
    } else if (section === 'received') {
      return `${baseStyle} ${isActive 
        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-2xl shadow-green-500/25' 
        : 'bg-green-50 text-green-700 hover:bg-green-100 border-2 border-green-200'}`;
    } else if (section === 'hardcopyMissing') {
      return `${baseStyle} ${isActive 
        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-2xl shadow-orange-500/25' 
        : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-2 border-orange-200'}`;
    } else {
      return `${baseStyle} ${isActive 
        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-2xl shadow-blue-500/25' 
        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200'}`;
    }
  };

  const getViewModeButtonStyle = (mode: 'details' | 'list') => {
    const isActive = viewMode === mode;
    const baseStyle = "relative overflow-hidden px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center space-x-3";
    
    return `${baseStyle} ${isActive 
      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-2xl shadow-purple-500/25' 
      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-2 border-purple-200'}`;
  };

  // Compact status indicator for list view
  const getCompactStatusIndicator = (record: PQRecord) => {
    const shippingBill = record.shipping_bill_received;
    const pqStatus = record.pq_status;
    const permitStatus = record.permit_copy_status;

    if (shippingBill === true && 
        pqStatus === 'Received' && 
        (permitStatus === 'Received' || permitStatus === 'Not Required')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-red-500" />;
  };

  const renderListView = () => (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-4 border-b border-gray-200">
        <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
          <div className="col-span-1 flex items-center justify-center">Status</div>
          <div className="col-span-1">Date</div>
          <div className="col-span-2">Invoice #</div>
          <div className="col-span-2">Shipper</div>
          <div className="col-span-2">Buyer</div>
          <div className="col-span-1">Country</div>
          <div className="col-span-1">PQ Status</div>
          <div className="col-span-1">Hardcopy</div>
          <div className="col-span-1">Actions</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200">
        {filteredAndSortedRecords.map((record, index) => (
          <div
            key={record.id}
            className={`px-8 py-4 hover:bg-gray-50 transition-all duration-300 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
            }`}
          >
            <div className="grid grid-cols-12 gap-4 items-center text-sm">
              {/* Status Indicator */}
              <div className="col-span-1 flex justify-center">
                {getCompactStatusIndicator(record)}
              </div>

              {/* Date */}
              <div className="col-span-1 font-medium text-gray-900">
                {record.date}
              </div>

              {/* Invoice Number */}
              <div className="col-span-2">
                <div className="font-semibold text-gray-900 truncate" title={record.invoiceNumber}>
                  {record.invoice_number}
                </div>
                {record.uploadedInvoice && (
                  <button
                    onClick={() => handleDownloadInvoice(record)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1 mt-1"
                    title="Download Invoice"
                  >

                    <span>Download</span>
                  </button>
                )}
              </div>

              {/* Shipper */}
              <div className="col-span-2 text-gray-700 truncate" title={record.shipperName}>
                {record.shipper_name}
              </div>

              {/* Buyer */}
              <div className="col-span-2 text-gray-700 truncate" title={record.buyer}>
                {record.buyer}
              </div>

              {/* Country */}
              <div className="col-span-1 text-gray-700 truncate" title={record.destination_port}>
                {record.destination_port}
              </div>

              {/* PQ Status */}
              <div className="col-span-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  record.pq_status === 'Received' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {record.pq_status}
                </span>
              </div>

              {/* Hardcopy Status */}
              <div className="col-span-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  (record.pq_hardcopy || 'Not Received') === 'Received' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {(record.pq_hardcopy || 'Not Received') === 'Received' ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center space-x-2">
                <button
                  onClick={() => onEdit(record)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  title="Edit record"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(record.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="Delete record"
                >
                  <Trash2 size={16} />
                </button>
                {!isRecordCompleted(record) && (
                  <button
                    onClick={() => handleMarkCompleted(record)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Mark as completed"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailsView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredAndSortedRecords.length > 0 ? (
        filteredAndSortedRecords.map((record, index) => (
          <div
            key={record.id}
            className={`group relative overflow-hidden border-2 rounded-2xl p-5 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 ${getRecordBackgroundColor(record)}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <div className="relative space-y-3">
              {/* Header with Status */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 truncate" title={record.invoiceNumber}>
                    {record.invoice_number}
                  </h3>
                  <p className="text-xs text-gray-600">{record.date}</p>
                </div>
                {getRecordStatusIndicator(record)}
              </div>
              
              {/* Status Badges - Compact */}
              <div className="flex flex-wrap gap-1">
                {getShippingBillBadge(record.shipping_bill_received)}
                {getPQStatusBadge(record.pq_status, record.created_at)}
                {getPQHardcopyBadge(record.pq_hardcopy || 'Not Received')}
                {getPermitCopyBadge(record.permit_copy_status)}
              </div>
              
              {/* Key Information - Compact Grid */}
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 font-medium">Shipper</span>
                  <p className="text-sm font-semibold text-gray-900 truncate" title={record.shipper_name}>
                    {record.shipper_name}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Buyer</span>
                  <p className="text-sm font-semibold text-gray-900 truncate" title={record.buyer}>
                    {record.buyer}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Country</span>
                  <p className="text-sm font-semibold text-gray-900">{record.destination_port}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Commodity</span>
                  <p className="text-sm text-gray-800 line-clamp-2" title={record.commodity}>
                    {record.commodity}
                  </p>
                </div>
              </div>
              
              {/* Invoice Download */}
              {record.uploadedInvoice && (
                <button
                  onClick={() => handleDownloadInvoice(record)}
                  className="w-full group/download relative overflow-hidden px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg transform hover:scale-105 transition-all duration-300"
                  title="Download Invoice File"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover/download:translate-x-full transition-transform duration-500"></div>
                  <div className="relative flex items-center justify-center space-x-2">

                  </div>
                </button>
              )}
              
              {/* Action Buttons - Horizontal Layout */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onEdit(record)}
                    className="group relative overflow-hidden p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg transform hover:scale-110 transition-all duration-300"
                    title="Edit record"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <Edit size={14} className="relative" />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="group relative overflow-hidden p-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl shadow-lg transform hover:scale-110 transition-all duration-300"
                    title="Delete record"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <Trash2 size={14} className="relative" />
                  </button>
                </div>
                {!isRecordCompleted(record) && (
                  <button
                    onClick={() => handleMarkCompleted(record)}
                    className="group relative overflow-hidden px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300"
                    title="Mark as completed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <div className="relative flex items-center space-x-1">
                      <Check size={12} />
                      <span className="text-xs font-semibold">Complete</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="col-span-full text-center py-20 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20">
          <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Filter className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No records found</h3>
          <p className="text-gray-500 text-lg mb-8">Try adjusting your search or filter criteria</p>
          <button 
            onClick={clearAllFilters}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">
          <Activity className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">Records Management</span>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
        </div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent">
          Records View
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Manage and filter your PQ certification records with advanced controls
        </p>
      </div>

      {/* Export Actions */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => exportToExcel(filteredAndSortedRecords)}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold shadow-2xl shadow-green-500/25 transform hover:scale-105 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          <div className="relative flex items-center space-x-2">
            <Download size={18} />
            <span>Export Excel</span>
          </div>
        </button>
        <button
          onClick={() => exportToPDF(filteredAndSortedRecords)}
          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-semibold shadow-2xl shadow-red-500/25 transform hover:scale-105 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
          <div className="relative flex items-center space-x-2">
            <Download size={18} />
            <span>Export PDF</span>
          </div>
        </button>
      </div>

      {/* Section Toggle Buttons */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
        <div className="flex flex-col lg:flex-row items-center justify-between space-y-6 lg:space-y-0">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleSectionChange('all')}
              className={getSectionButtonStyle('all')}
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <Filter size={18} />
              </div>
              <span>All Records ({records.length})</span>
            </button>
            <button
              onClick={() => handleSectionChange('pending')}
              className={getSectionButtonStyle('pending')}
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <Clock size={18} />
              </div>
              <span>Pending PQ ({pendingCount})</span>
            </button>
            <button
              onClick={() => handleSectionChange('received')}
              className={getSectionButtonStyle('received')}
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <CheckCircle size={18} />
              </div>
              <span>Received PQ ({receivedCount})</span>
            </button>
            <button
              onClick={() => handleSectionChange('hardcopyMissing')}
              className={getSectionButtonStyle('hardcopyMissing')}
            >
              <div className="p-1 bg-white/20 rounded-lg">
                <Award size={18} />
              </div>
              <span>Hardcopy Missing ({hardcopyMissingCount})</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-2">
              <button
                onClick={() => setViewMode('details')}
                className={getViewModeButtonStyle('details')}
              >
                <div className="p-1 bg-white/20 rounded-lg">
                  <Grid size={18} />
                </div>
                <span>Details</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={getViewModeButtonStyle('list')}
              >
                <div className="p-1 bg-white/20 rounded-lg">
                  <List size={18} />
                </div>
                <span>List</span>
              </button>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full">
              <Sparkles className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Showing {currentSectionCount} records</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search records by any field..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-gray-900 placeholder-gray-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>
          
          {/* Filter Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {/* Date Range Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
              />
            </div>

            {/* Shipper Dropdown Filter */}
            <select
              value={filters.shipper_name || ''}
              onChange={(e) => setFilters({ ...filters, shipper_name: e.target.value || undefined })}
              className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
            >
              <option value="">All Shippers</option>
              {uniqueShipperNames.map(shipperName => (
                <option key={shipperName} value={shipperName}>
                  {shipperName}
                </option>
              ))}
            </select>

            <select
              value={filters.shipping_bill_received || ''}
              onChange={(e) => setFilters({ ...filters, shipping_bill_received: e.target.value || undefined })}
              className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
            >
              <option value="">All Bill Status</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>

            {/* PQ Hardcopy Filter */}
            <select
              value={filters.pq_hardcopy || ''}
              onChange={(e) => setFilters({ ...filters, pq_hardcopy: e.target.value || undefined })}
              className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
            >
              <option value="">All PQ Hardcopy</option>
              <option value="Received">Received</option>
              <option value="Not Received">Not Received</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as keyof PQRecord)}
              className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
            >
              <option value="createdAt">Sort by Created Date</option>
              <option value="date">Sort by Shipment Date</option>
              <option value="shipperName">Sort by Shipper</option>
              <option value="buyer">Sort by Buyer</option>
              <option value="destinationPort">Sort by Country</option>
              <option value="pqStatus">Sort by Status</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-4 py-3 bg-white/80 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || Object.keys(filters).length > 0 || dateRange.start || dateRange.end) && (
            <div className="flex justify-center">
              <button
                onClick={clearAllFilters}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-slate-600 text-white rounded-2xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Records Display */}
      {viewMode === 'list' ? renderListView() : renderDetailsView()}
    </div>
  );
};

export default RecordsView;