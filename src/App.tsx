import React, { useState, useEffect } from 'react';
import { PQRecord } from './types';
import { getAllPQRecords } from './utils/storage';
import Dashboard from './components/Dashboard';
import PQEntryForm from './components/PQEntryForm';
import RecordsView from './components/RecordsView';
import { 
  BarChart3, 
  Plus, 
  FileText, 
  Ship,
  Sparkles
} from 'lucide-react';

type ActiveTab = 'dashboard' | 'form' | 'records';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [records, setRecords] = useState<PQRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<PQRecord | undefined>();
  const [recordsFilter, setRecordsFilter] = useState<{ pqStatus?: string; pqHardcopy?: string }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecords();
    // Simulate loading for smooth transition
    setTimeout(() => setIsLoading(false), 800);
  }, []);

  const loadRecords = async () => {
    const records = await getAllPQRecords();
    setRecords(records);
  };

  const handleSave = () => {
    loadRecords();
    setEditingRecord(undefined);
    if (activeTab === 'form') {
      if (editingRecord) {
        setActiveTab('records');
      }
    }
  };

  const handleEdit = (record: PQRecord) => {
    setEditingRecord(record);
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setEditingRecord(undefined);
    setActiveTab('records');
  };

  const handleDashboardFilter = (filterType: string) => {
    if (filterType === 'pendingPQ') {
      // Set filter to show all incomplete records (not just "Pending" status)
      setRecordsFilter({ pqStatus: 'incomplete' }); // Special filter for incomplete records
      setActiveTab('records');
    } else if (filterType === 'pqHardcopyMissing') {
      // Set filter to show only PQ Hardcopy Missing records
      setRecordsFilter({ pqHardcopy: 'Not Received' });
      setActiveTab('records');
    }
  };

  const tabs = [
    { id: 'dashboard' as ActiveTab, name: 'Dashboard', icon: BarChart3, gradient: 'from-blue-500 to-purple-600' },
    { id: 'form' as ActiveTab, name: 'PQ Entry', icon: Plus, gradient: 'from-green-500 to-teal-600' },
    { id: 'records' as ActiveTab, name: 'Records', icon: FileText, gradient: 'from-orange-500 to-red-600' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-purple-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="text-lg font-medium">Loading PQ Certificate Tracker</span>
            <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-400/20 to-blue-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Header */}
      <header className="relative backdrop-blur-xl bg-white/80 shadow-xl border-b border-white/20 sticky top-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-indigo-600/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl transform group-hover:scale-105 transition duration-300">
                  <Ship className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  PQ Certificate Tracker
                </h1>
                <p className="text-sm text-gray-600 font-medium">Export Shipment Certification Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-200/50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">{records.length} total records</span>
              </div>
              <div className="w-10 h-10 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="relative backdrop-blur-xl bg-white/70 border-b border-white/20 sticky top-20 z-40">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-indigo-50/50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'form') {
                      setEditingRecord(undefined);
                    }
                    if (tab.id === 'records' && (recordsFilter.pqStatus || recordsFilter.pqHardcopy)) {
                      // Don't clear the filter when navigating to records
                      // setRecordsFilter({});
                    }
                  }}
                  className={`group relative flex items-center space-x-3 px-6 py-4 rounded-2xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 ${
                    isActive
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-2xl shadow-blue-500/25`
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-lg'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl"></div>
                  )}
                  <div className={`relative p-1 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white'} transition-colors duration-300`}>
                    <Icon size={18} className={isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'} />
                  </div>
                  <span className="relative">{tab.name}</span>
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="transform transition-all duration-500 ease-out">
          {activeTab === 'dashboard' && (
            <div className="animate-fadeIn">
              <Dashboard 
                records={records} 
                onFilterClick={handleDashboardFilter}
              />
            </div>
          )}
          
          {activeTab === 'form' && (
            <div className="animate-slideInRight">
              <PQEntryForm 
                editRecord={editingRecord}
                onSave={handleSave}
                onCancel={editingRecord ? handleCancelEdit : undefined}
              />
            </div>
          )}
          
          {activeTab === 'records' && (
            <div className="animate-slideInLeft">
              <RecordsView 
                records={records}
                onEdit={handleEdit}
                onRecordsChange={loadRecords}
                initialFilter={recordsFilter}
                onFilterChange={setRecordsFilter}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      {activeTab !== 'form' && (
        <button
          onClick={() => setActiveTab('form')}
          className="fixed bottom-8 right-8 group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
          <div className="relative w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-2xl transform group-hover:scale-110 transition duration-300">
            <Plus size={24} />
          </div>
        </button>
      )}
    </div>
  );
}

export default App;