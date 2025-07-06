import React, { useState, useEffect, useRef } from 'react';
import { PQRecord } from '../types';
import { savePQRecord, updatePQRecord, generateId } from '../utils/storage';
import { formatDate } from '../utils/dateHelpers';
import { Save, Upload, X, FileSpreadsheet, Sparkles, Zap, CheckCircle, AlertCircle, Calendar, User, Building, Package, MapPin, FileText, MessageSquare, Award } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PQEntryFormProps {
  editRecord?: PQRecord;
  onSave: () => void;
  onCancel?: () => void;
}

const PQEntryForm: React.FC<PQEntryFormProps> = ({ editRecord, onSave, onCancel }) => {
  // Use refs to maintain stable references
  const formRef = useRef<HTMLFormElement>(null);
  
  const [formData, setFormData] = useState<Pick<PQRecord, Exclude<keyof PQRecord, 'id'>>>({
    date: formatDate(new Date()),
    shipper_name: '',
    buyer: '',
    invoice_number: '',
    commodity: '',
    shipping_bill_received: false,
    pq_status: 'Pending' as const,
    pq_hardcopy: 'Not Received' as const,
    permit_copy_status: 'Not Required' as const,
    destination_port: '',
    remarks: '',
    files: [],
    created_at: formatDate(new Date()),
    updated_at: formatDate(new Date())
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [extractionLog, setExtractionLog] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    if (editRecord) {
      setFormData({
        date: editRecord.date || formatDate(new Date()),
        shipper_name: editRecord.shipper_name || '',
        buyer: editRecord.buyer || '',
        invoice_number: String(editRecord.invoice_number || ''),
        commodity: editRecord.commodity || '',
        shipping_bill_received: editRecord.shipping_bill_received || false,
        pq_status: editRecord.pq_status || 'Pending',
        pq_hardcopy: editRecord.pq_hardcopy || 'Not Received',
        permit_copy_status: editRecord.permit_copy_status || 'Not Required',
        destination_port: editRecord.destination_port,
        remarks: editRecord.remarks
      });
    }
  }, [editRecord]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.shipper_name || !formData.shipper_name.trim()) {
      newErrors.shipper_name = 'Shipper name is required';
    }
    if (!formData.buyer || !formData.buyer.trim()) {
      newErrors.buyer = 'Buyer name is required';
    }
    if (!formData.invoice_number || !formData.invoice_number.trim()) {
      newErrors.invoice_number = 'Invoice number is required';
    }
    if (!formData.commodity || !formData.commodity.trim()) {
      newErrors.commodity = 'Commodity is required';
    }
    if (!formData.destination_port || !formData.destination_port.trim()) {
      newErrors.destination_port = 'Destination country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const extractInvoiceNumber = (text: string): string => {
    const cleanText = text.trim();
    const invoiceMatch = cleanText.match(/([A-Z]{2,4}\/\d+\/\d{4}-\d{2})/);
    if (invoiceMatch) {
      return invoiceMatch[1];
    }
    
    const dateIndicators = ['DT:', 'DATE:', 'dt:', 'date:', ' DT', ' DATE'];
    for (const indicator of dateIndicators) {
      const index = cleanText.indexOf(indicator);
      if (index > 0) {
        return cleanText.substring(0, index).trim();
      }
    }
    
    return cleanText;
  };

  const extractDataFromExcel = async (file: File): Promise<void> => {
    setIsProcessingFile(true);
    setExtractionLog(['🔍 Starting precise data extraction from invoice...']);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
      setExtractionLog(prev => [...prev, `📊 Analyzing sheet: ${sheetName} (${range.s.r + 1}:${range.e.r + 1} rows, ${range.s.c + 1}:${range.e.c + 1} cols)`]);

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      const cellMap: { [key: string]: { value: string; row: number; col: number } } = {};
      
      for (let row = 0; row < jsonData.length; row++) {
        for (let col = 0; col < (jsonData[row]?.length || 0); col++) {
          const cellValue = jsonData[row][col];
          if (cellValue && cellValue.toString().trim()) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            cellMap[cellAddress] = {
              value: cellValue.toString().trim(),
              row: row,
              col: col
            };
          }
        }
      }

      setExtractionLog(prev => [...prev, `📋 Found ${Object.keys(cellMap).length} non-empty cells`]);

      const extractedData: Partial<Pick<PQRecord, Exclude<keyof PQRecord, 'id'>>> = {};
      const extractionDetails: string[] = [];

      // Extract Shipper Name
      setExtractionLog(prev => [...prev, '🏢 Searching for Exporter/Shipper information...']);
      
      for (const [address, cell] of Object.entries(cellMap)) {
        if (cell.value.toLowerCase().includes('exporter')) {
          for (let i = 1; i <= 3; i++) {
            const nextRowAddress = XLSX.utils.encode_cell({ r: cell.row + i, c: cell.col });
            if (cellMap[nextRowAddress]) {
              const companyName = cellMap[nextRowAddress].value;
              if (companyName.length > 5 && !companyName.toLowerCase().includes('consignee')) {
                extractedData.shipper_name = companyName;
                extractionDetails.push(`Shipper: "${companyName}" found at ${nextRowAddress}`);
                break;
              }
            }
          }
          break;
        }
      }

      // Extract Buyer/Consignee
      setExtractionLog(prev => [...prev, '👤 Searching for Buyer/Consignee information...']);
      
      for (const [address, cell] of Object.entries(cellMap)) {
        if (cell.value.toLowerCase().includes('consignee')) {
          for (let i = 0; i <= 3; i++) {
            const nextRowAddress = XLSX.utils.encode_cell({ r: cell.row + i, c: cell.col });
            if (cellMap[nextRowAddress]) {
              const buyerName = cellMap[nextRowAddress].value;
              if (buyerName.length > 3 && 
                  !buyerName.toLowerCase().includes('consignee') && 
                  !buyerName.toLowerCase().includes(':')) {
                extractedData.buyer = buyerName;
                extractionDetails.push(`Buyer: "${buyerName}" found at ${nextRowAddress}`);
                break;
              }
            }
          }
          break;
        }
      }

      if (!extractedData.buyer) {
        setExtractionLog(prev => [...prev, '🔍 Searching buyer in range M10:X10...']);
        for (let col = 12; col <= 23; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 9, c: col });
          if (cellMap[cellAddress]) {
            const value = cellMap[cellAddress].value;
            if (value.length > 5 && 
                !value.toLowerCase().includes('invoice') && 
                !value.toLowerCase().includes('date') &&
                !value.toLowerCase().includes('no.') &&
                !value.toLowerCase().includes('ref')) {
              extractedData.buyer = value;
              extractionDetails.push(`Buyer: "${value}" found at ${cellAddress} (M10:X10 range)`);
              break;
            }
          }
        }
      }

      // Extract Invoice Number
      setExtractionLog(prev => [...prev, '📄 Searching for Invoice Number (excluding date)...']);
      
      for (const [address, cell] of Object.entries(cellMap)) {
        if (cell.value.toLowerCase().includes('invoice') && 
            !cell.value.toLowerCase().includes('proforma')) {
          
          for (let colOffset = 1; colOffset <= 5; colOffset++) {
            const sameRowAddress = XLSX.utils.encode_cell({ r: cell.row, c: cell.col + colOffset });
            if (cellMap[sameRowAddress]) {
              const invoiceValue = cellMap[sameRowAddress].value;
              const cleanInvoiceNumber = extractInvoiceNumber(invoiceValue);
              if (cleanInvoiceNumber.match(/[A-Z]{2,4}\/\d+\/\d{4}-\d{2}/)) {
                extractedData.invoice_number = cleanInvoiceNumber;
                extractionDetails.push(`Invoice: "${cleanInvoiceNumber}" found at ${sameRowAddress} (cleaned from: "${invoiceValue}")`);
                break;
              }
            }
          }
          
          if (!extractedData.invoice_number) {
            for (let rowOffset = 1; rowOffset <= 3; rowOffset++) {
              const nextRowAddress = XLSX.utils.encode_cell({ r: cell.row + rowOffset, c: cell.col });
              if (cellMap[nextRowAddress]) {
                const invoiceValue = cellMap[nextRowAddress].value;
                const cleanInvoiceNumber = extractInvoiceNumber(invoiceValue);
                if (cleanInvoiceNumber.match(/[A-Z]{2,4}\/\d+\/\d{4}-\d{2}/)) {
                  extractedData.invoice_number = cleanInvoiceNumber;
                  extractionDetails.push(`Invoice: "${cleanInvoiceNumber}" found at ${nextRowAddress} (cleaned from: "${invoiceValue}")`);
                  break;
                }
              }
            }
          }
          
          if (extractedData.invoice_number) break;
        }
      }

      if (!extractedData.invoice_number) {
        setExtractionLog(prev => [...prev, '🔍 Searching invoice number in M4+ area...']);
        for (let row = 3; row <= 10; row++) {
          for (let col = 12; col <= 20; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (cellMap[cellAddress]) {
              const value = cellMap[cellAddress].value;
              const cleanInvoiceNumber = extractInvoiceNumber(value);
              if (cleanInvoiceNumber.match(/[A-Z]{2,4}\/\d+\/\d{4}-\d{2}/)) {
                extractedData.invoice_number = cleanInvoiceNumber;
                extractionDetails.push(`Invoice: "${cleanInvoiceNumber}" found at ${cellAddress} (M4+ area, cleaned from: "${value}")`);
                break;
              }
            }
          }
          if (extractedData.invoice_number) break;
        }
      }

      // Extract Commodity
      setExtractionLog(prev => [...prev, '📦 Searching for Commodity information...']);
      
      const commodityKeywords = ['chillies', 'turmeric', 'rice', 'spices', 'jaggery', 'onions', 'sannam'];
      for (const [address, cell] of Object.entries(cellMap)) {
        const cellValue = cell.value.toLowerCase();
        for (const keyword of commodityKeywords) {
          if (cellValue.includes(keyword)) {
            extractedData.commodity = cell.value;
            extractionDetails.push(`Commodity: "${cell.value}" found at ${address}`);
            break;
          }
        }
        if (extractedData.commodity) break;
      }

      // Extract Destination Country
      setExtractionLog(prev => [...prev, '🌍 Searching for Final Destination Country (NOT Origin)...']);
      
      for (const [address, cell] of Object.entries(cellMap)) {
        const cellValue = cell.value.toLowerCase();
        
        if (cellValue.includes('final destination') || 
            cellValue.includes('country of final destination') ||
            cellValue.includes('destination country')) {
          
          for (let colOffset = 1; colOffset <= 5; colOffset++) {
            const adjacentAddress = XLSX.utils.encode_cell({ r: cell.row, c: cell.col + colOffset });
            if (cellMap[adjacentAddress]) {
              const destinationValue = cellMap[adjacentAddress].value;
              if (destinationValue.length > 2 && 
                  !destinationValue.toLowerCase().includes('destination') &&
                  !destinationValue.toLowerCase().includes('country') &&
                  !destinationValue.toLowerCase().includes('origin')) {
                
                let cleanDestination = destinationValue.toUpperCase();
                if (cleanDestination.includes('SRI LANKA') || cleanDestination.includes('SRILANKA')) {
                  extractedData.destination_port = 'SRI LANKA';
                } else if (cleanDestination.includes('COLOMBO')) {
                  extractedData.destination_port = 'SRI LANKA';
                } else {
                  extractedData.destination_port = cleanDestination;
                }
                
                extractionDetails.push(`Destination: "${extractedData.destination_port}" found at ${adjacentAddress} (from ${address})`);
                break;
              }
            }
          }
          
          if (!extractedData.destination_port) {
            const belowAddress = XLSX.utils.encode_cell({ r: cell.row + 1, c: cell.col });
            if (cellMap[belowAddress]) {
              const destinationValue = cellMap[belowAddress].value;
              if (destinationValue.length > 2 && 
                  !destinationValue.toLowerCase().includes('destination') &&
                  !destinationValue.toLowerCase().includes('country') &&
                  !destinationValue.toLowerCase().includes('origin')) {
                
                let cleanDestination = destinationValue.toUpperCase();
                if (cleanDestination.includes('SRI LANKA') || cleanDestination.includes('SRILANKA')) {
                  extractedData.destination_port = 'SRI LANKA';
                } else if (cleanDestination.includes('COLOMBO')) {
                  extractedData.destination_port = 'SRI LANKA';
                } else {
                  extractedData.destination_port = cleanDestination;
                }
                
                extractionDetails.push(`Destination: "${extractedData.destination_port}" found at ${belowAddress} (below ${address})`);
              }
            }
          }
          
          if (extractedData.destination_port) break;
        }
      }

      if (!extractedData.destinationPort) {
        setExtractionLog(prev => [...prev, '🔍 Fallback search for destination countries (avoiding origin)...']);
        
        const destinationCountries = ['sri lanka', 'srilanka', 'bangladesh', 'nepal', 'pakistan', 'myanmar', 'maldives'];
        for (const [address, cell] of Object.entries(cellMap)) {
          const cellValue = cell.value.toLowerCase();
          
          if (cellValue.includes('origin') || cellValue.includes('goods') || cellValue.includes('country of origin')) {
            continue;
          }
          
          for (const country of destinationCountries) {
            if (cellValue.includes(country)) {
              if (cellValue.includes('sri lanka') || cellValue.includes('srilanka')) {
                extractedData.destination_port = 'SRI LANKA';
              } else {
                extractedData.destination_port = country.toUpperCase();
              }
              extractionDetails.push(`Destination: "${extractedData.destination_port}" found at ${address} (fallback search)`);
              break;
            }
          }
          if (extractedData.destination_port) break;
        }
      }

      setExtractionLog(prev => [...prev, ...extractionDetails]);

      if (Object.keys(extractedData).length > 0) {
        // Update form data in a single batch
        setFormData(prev => ({
          ...prev,
          ...extractedData
        }));
        
        setExtractionLog(prev => [...prev, `🎉 Successfully extracted ${Object.keys(extractedData).length} fields!`]);
        
        const foundFields = Object.entries(extractedData).map(([key, value]) => `${key}: "${value}"`).join(', ');
        setExtractionLog(prev => [...prev, `📋 Extracted: ${foundFields}`]);
      } else {
        setExtractionLog(prev => [...prev, '❌ No recognizable data patterns found. Please check the Excel file structure.']);
        setErrors(prev => ({
          ...prev,
          file: 'Unable to extract data from this Excel file. Please ensure it contains invoice information with proper formatting.'
        }));
      }

    } catch (error) {
      console.error('Error processing Excel file:', error);
      setExtractionLog(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setErrors(prev => ({
        ...prev,
        file: 'Error processing Excel file. Please check the file format and try again.'
      }));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setExtractionLog([]);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.file;
        return newErrors;
      });

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        await extractDataFromExcel(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setErrors({});

    // Validate required fields
    const newErrors: Record<string, string> = {};

    if (!formData.shipper_name || !formData.shipper_name.trim()) {
      newErrors.shipper_name = 'Shipper name is required';
    }
    if (!formData.buyer || !formData.buyer.trim()) {
      newErrors.buyer = 'Buyer name is required';
    }
    if (!formData.invoice_number || !formData.invoice_number.trim()) {
      newErrors.invoice_number = 'Invoice number is required';
    }
    if (!formData.commodity || !formData.commodity.trim()) {
      newErrors.commodity = 'Commodity is required';
    }
    if (!formData.destination_port || !formData.destination_port.trim()) {
      newErrors.destination_port = 'Destination country is required';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setIsSubmitting(false);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const record: PQRecord = {
      id: editRecord?.id || generateId(),
      date: formData.date,
      shipper_name: formData.shipper_name.trim(),
      buyer: formData.buyer.trim(),
      invoice_number: formData.invoice_number.trim(),
      commodity: formData.commodity.trim(),
      shipping_bill_received: formData.shipping_bill_received,
      pq_status: formData.pq_status,
      pq_hardcopy: formData.pq_hardcopy,
      permit_copy_status: formData.permit_copy_status,
      destination_port: formData.destination_port.trim(),
      remarks: formData.remarks.trim(),
      files: formData.files,
      created_at: editRecord?.created_at || formatDate(new Date()),
      updated_at: formatDate(new Date())
    } as PQRecord;

    if (editRecord) {
      await updatePQRecord(record.id, record);
    } else {
      await savePQRecord(record);
    }
    
    setShowSuccessAnimation(true);
    
    setTimeout(() => {
      onSave();
      setIsSubmitting(false);
      setShowSuccessAnimation(false);

      if (!editRecord) {
        setFormData({
          date: formatDate(new Date()),
          shipper_name: '',
          buyer: '',
          invoice_number: '',
          commodity: '',
          shipping_bill_received: false,
          pq_status: 'Pending' as const,
          pq_hardcopy: false,
          permit_copy_status: 'Not Required' as const,
          destination_port: '',
          remarks: '',
          files: [],
          created_at: formatDate(new Date()),
          updated_at: formatDate(new Date())
        });
        setUploadedFile(null);
        setExtractionLog([]);
      }
    }, 1500);
  };

  const removeFile = () => {
    setUploadedFile(null);
    setExtractionLog([]);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.file;
      return newErrors;
    });
  };

  const getFieldStyles = (fieldName: string, value: string) => {
    const baseStyles = "w-full px-6 py-4 bg-white/90 backdrop-blur-sm border-2 rounded-2xl focus:outline-none focus:ring-4 transition-all duration-300 text-gray-900 placeholder-gray-500";
    
    if (fieldName === 'shipping_bill_received') {
      const valueStr = value ? 'Yes' : 'No';
      switch (valueStr) {
        case 'Yes':
          return `${baseStyles} border-green-300 focus:ring-green-500/20 focus:border-green-500 bg-gradient-to-r from-green-50 to-emerald-50`;
        case 'No':
          return `${baseStyles} border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-gradient-to-r from-red-50 to-rose-50`;
        default:
          return `${baseStyles} border-gray-300 focus:ring-blue-500/20 focus:border-blue-500`;
      }
    }
    
    if (fieldName === 'pq_status') {
      switch (value) {
        case 'Received':
          return `${baseStyles} border-green-300 focus:ring-green-500/20 focus:border-green-500 bg-gradient-to-r from-green-50 to-emerald-50`;
        case 'Pending':
          return `${baseStyles} border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-gradient-to-r from-red-50 to-rose-50`;
        default:
          return `${baseStyles} border-gray-300 focus:ring-blue-500/20 focus:border-blue-500`;
      }
    }
    
    if (fieldName === 'pq_hardcopy') {
      switch (value) {
        case 'Received':
          return `${baseStyles} border-green-300 focus:ring-green-500/20 focus:border-green-500 bg-gradient-to-r from-green-50 to-emerald-50`;
        case 'Not Received':
          return `${baseStyles} border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-gradient-to-r from-red-50 to-rose-50`;
        default:
          return `${baseStyles} border-gray-300 focus:ring-blue-500/20 focus:border-blue-500`;
      }
    }
    
    if (fieldName === 'permit_copy_status') {
      switch (value) {
        case 'Received':
        case 'Not Required':
          return `${baseStyles} border-green-300 focus:ring-green-500/20 focus:border-green-500 bg-gradient-to-r from-green-50 to-emerald-50`;
        case 'Not Received':
          return `${baseStyles} border-red-300 focus:ring-red-500/20 focus:border-red-500 bg-gradient-to-r from-red-50 to-rose-50`;
        default:
          return `${baseStyles} border-gray-300 focus:ring-blue-500/20 focus:border-blue-500`;
      }
    }
    
    return `${baseStyles} border-gray-300 focus:ring-blue-500/20 focus:border-blue-500 hover:border-blue-400 focus:shadow-lg focus:transform focus:scale-[1.02]`;
  };

  // Simple input change handler that doesn't cause re-renders
  const handleInputChange = (fieldName: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Update form data directly without causing component re-render
    setFormData(prevData => {
      const newData = { ...prevData };
      if (fieldName === 'shipping_bill_received') {
        newData[fieldName] = value === 'Yes';
      } else if (fieldName === 'pq_status') {
        newData[fieldName] = value as 'Pending' | 'Received';
      } else if (fieldName === 'pq_hardcopy') {
        newData[fieldName] = value as 'Received' | 'Not Received';
      } else if (fieldName === 'permit_copy_status') {
        newData[fieldName] = value as 'Received' | 'Not Received' | 'Not Required';
      } else {
        newData[fieldName] = value;
      }
      return newData;
    });
    
    // Clear error for this field if it exists
    if (errors[fieldName]) {
      setErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {showSuccessAnimation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-12 text-center shadow-2xl transform animate-pulse">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Success!</h3>
            <p className="text-gray-600">PQ Entry has been saved successfully</p>
          </div>
        </div>
      )}

      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-100 to-teal-100 rounded-full">
          <Sparkles className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-gray-700">PQ Entry Management</span>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-800 to-teal-800 bg-clip-text text-transparent">
          {editRecord ? 'Edit PQ Entry' : 'Create New PQ Entry'}
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          {editRecord ? 'Update your PQ certification details' : 'Enter comprehensive shipment and certification details'}
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        {/* Upload Invoice Section */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">📊 Smart Invoice Upload</h3>
              <p className="text-sm text-gray-600">Advanced data extraction with improved pattern recognition</p>
            </div>
          </div>
          
          <div className="border-2 border-dashed border-blue-300 rounded-2xl p-8 hover:border-blue-400 transition-all duration-300 bg-white/50 backdrop-blur-sm">
            {!uploadedFile && !editRecord?.uploadedInvoice ? (
              <div className="text-center">
                {isProcessingFile ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-blue-600">🔍 Enhanced Data Extraction</p>
                      <p className="text-sm text-gray-600">Analyzing invoice structure and extracting key information</p>
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                        <div className="relative flex items-center space-x-4 p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl">
                          <Upload className="h-10 w-10 text-white" />
                          <FileSpreadsheet className="h-10 w-10 text-white" />
                          <Zap className="h-8 w-8 text-yellow-300" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="cursor-pointer group">
                        <div className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold shadow-2xl transform group-hover:scale-105 transition-all duration-300">
                          <Upload size={20} />
                          <span>Upload Excel Invoice</span>
                          <Sparkles size={18} />
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <p className="text-gray-600 text-sm">
                        Excel files will be analyzed with enhanced pattern recognition for better data extraction
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                    <FileSpreadsheet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {uploadedFile?.name || 'Previously uploaded file'}
                    </p>
                    <p className="text-sm text-gray-600">Ready for processing</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-200"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
          
          {errors.file && (
            <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-2xl">
              <AlertCircle size={20} />
              <p className="font-medium">{errors.file}</p>
            </div>
          )}
          
          {extractionLog.length > 0 && (
            <div className="mt-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">🔍 Enhanced Extraction Analysis</h4>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {extractionLog.map((log, index) => (
                  <div key={index} className="text-xs font-mono bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-3 bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Shipment Details</h3>
              <p className="text-sm text-gray-600">Complete all required fields for PQ certification</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><Calendar size={18} /></div>
                  <span>Shipment Date</span>
                  <span className="text-red-500 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange('date')}
                    className={getFieldStyles('date', formData.date)}
                  />
                  {formData.date && !errors.date && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Date of shipment dispatch</p>
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><Building size={18} /></div>
                  <span>Shipper Name</span>
                  <span className="text-red-500 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.shipper_name}
                    onChange={handleInputChange('shipper_name')}
                    className={getFieldStyles('shipper_name', formData.shipper_name)}
                    placeholder="Enter shipper name..."
                  />
                  {formData.shipper_name && !errors.shipper_name && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {errors.shipper_name && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Exporting company name</p>
                {errors.shipperName && (
                  <div className="flex items-center space-x-2 mt-2 text-red-600">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">{errors.shipper_name}</p>
                  </div>
                )}
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><User size={18} /></div>
                  <span>Buyer Name</span>
                  <span className="text-red-500 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.buyer}
                    onChange={handleInputChange('buyer')}
                    className={getFieldStyles('buyer', formData.buyer)}
                    placeholder="Enter buyer name..."
                  />
                  {formData.buyer && !errors.buyer && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {errors.buyer && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Importing company or consignee</p>
                {errors.buyer && (
                  <div className="flex items-center space-x-2 mt-2 text-red-600">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">{errors.buyer}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice and Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><FileText size={18} /></div>
                  <span>Invoice Number</span>
                  <span className="text-red-500 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.invoice_number}
                    onChange={handleInputChange('invoice_number')}
                    className={getFieldStyles('invoice_number', formData.invoice_number)}
                    placeholder="Enter invoice number..."
                    min="1"
                  />
                  {formData.invoice_number && !errors.invoice_number && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {errors.invoice_number && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Format: RTC/037/2025-26 (date excluded)</p>
                {errors.invoice_number && (
                  <div className="flex items-center space-x-2 mt-2 text-red-600">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">{errors.invoice_number}</p>
                  </div>
                )}
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><MapPin size={18} /></div>
                  <span>Destination Country</span>
                  <span className="text-red-500 text-lg">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.destination_port}
                    onChange={handleInputChange('destination_port')}
                    className={getFieldStyles('destination_port', formData.destination_port)}
                    placeholder="Enter destination country..."
                  />
                  {formData.destination_port && !errors.destination_port && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {errors.destination_port && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Final destination country</p>
                {errors.destination_port && (
                  <div className="flex items-center space-x-2 mt-2 text-red-600">
                    <AlertCircle size={16} />
                    <p className="text-sm font-medium">{errors.destination_port}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Commodity */}
            <div className="group">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="text-blue-600"><Package size={18} /></div>
                <span>Commodity (Agro Products)</span>
                <span className="text-red-500 text-lg">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={formData.commodity}
                  onChange={handleInputChange('commodity')}
                  rows={4}
                  className={getFieldStyles('commodity', formData.commodity)}
                  placeholder="Enter commodity (agro products)..."
                />
                {formData.commodity && !errors.commodity && (
                  <div className="absolute right-4 top-4">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
                {errors.commodity && (
                  <div className="absolute right-4 top-4">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1">Examples: Red Chillies, Turmeric Powder, Basmati Rice, Organic Jaggery, Fresh Onions, Assorted Spices</p>
              {errors.commodity && (
                <div className="flex items-center space-x-2 mt-2 text-red-600">
                  <AlertCircle size={16} />
                  <p className="text-sm font-medium">{errors.commodity}</p>
                </div>
              )}
            </div>

            {/* Status Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><CheckCircle size={18} /></div>
                  <span>Shipping Bill Copy</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.shipping_bill_received ? 'Yes' : 'No'}
                    onChange={(e) => handleInputChange('shipping_bill_received')(e)}
                    className={getFieldStyles('shipping_bill_received', formData.shipping_bill_received)}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Document received status</p>
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><Zap size={18} /></div>
                  <span>PQ Status</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.pq_status}
                    onChange={handleInputChange('pq_status')}
                    className={getFieldStyles('pq_status', formData.pq_status)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Received">Received</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Phytosanitary certificate status</p>
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><Award size={18} /></div>
                  <span>PQ Hardcopy</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.pq_hardcopy}
                    onChange={handleInputChange('pq_hardcopy')}
                    className={getFieldStyles('pq_hardcopy', formData.pq_hardcopy)}
                  >
                    <option value="Received">Received</option>
                    <option value="Not Received">Not Received</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Physical PQ certificate received</p>
              </div>

              <div className="group">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                  <div className="text-blue-600"><FileText size={18} /></div>
                  <span>Permit Copy Status</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.permit_copy_status}
                    onChange={handleInputChange('permit_copy_status')}
                    className={getFieldStyles('permit_copy_status', formData.permit_copy_status)}
                  >
                    <option value="Received">Received</option>
                    <option value="Not Received">Not Received</option>
                    <option value="Not Required">Not Required</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">Import permit document status</p>
              </div>
            </div>

            {/* Remarks */}
            <div className="group">
              <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
                <div className="text-blue-600"><MessageSquare size={18} /></div>
                <span>Remarks</span>
              </label>
              <div className="relative">
                <textarea
                  value={formData.remarks}
                  onChange={handleInputChange('remarks')}
                  rows={4}
                  className={getFieldStyles('remarks', formData.remarks)}
                  placeholder="Enter remarks..."
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1">Additional notes or special instructions</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-6 pt-8">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isProcessingFile || isSubmitting}
            className="group relative overflow-hidden px-10 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-2xl font-semibold shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <div className="relative flex items-center space-x-3">
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>{editRecord ? 'Update Entry' : 'Save Entry'}</span>
                  <Sparkles size={18} />
                </>
              )}
            </div>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PQEntryForm;