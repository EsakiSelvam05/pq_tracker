import { PQRecord } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (records: PQRecord[], filename: string = 'pq_records') => {
  const exportData = records.map(record => ({
    'Date': record.date,
    'Shipper Name': record.shipperName,
    'Buyer Name': record.buyer,
    'Invoice Number': record.invoiceNumber,
    'Commodity': record.commodity,
    'Shipping Bill Copy': record.shippingBillReceived,
    'PQ Status': record.pqStatus,
    'PQ Hardcopy': record.pqHardcopy || 'Not Received', // Handle existing records without this field
    'Permit Copy Status': record.permitCopyStatus,
    'Destination Country': record.destinationPort,
    'Remarks': record.remarks
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PQ Records');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (records: PQRecord[], filename: string = 'pq_records') => {
  const doc = new jsPDF('l', 'mm', 'a4');
  
  doc.setFontSize(16);
  doc.text('PQ Certificate Tracker - Records', 14, 15);
  
  const tableData = records.map(record => [
    record.date,
    record.shipperName,
    record.buyer,
    record.invoiceNumber,
    record.commodity.substring(0, 20) + (record.commodity.length > 20 ? '...' : ''),
    record.shippingBillReceived,
    record.pqStatus,
    record.pqHardcopy || 'Not Received', // Handle existing records without this field
    record.destinationPort
  ]);

  autoTable(doc, {
    head: [['Date', 'Shipper', 'Buyer', 'Invoice #', 'Commodity', 'Bill Copy', 'PQ Status', 'PQ Hardcopy', 'Country']],
    body: tableData,
    startY: 25,
    styles: { fontSize: 6 }, // Reduced font size to fit new column
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`${filename}.pdf`);
};