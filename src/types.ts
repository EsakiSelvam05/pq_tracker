export interface PQRecord {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
  shipper_name: string;
  buyer: string;
  invoice_number: string;
  commodity: string;
  shipping_bill_received: boolean;
  pq_status: string;
  pq_hardcopy: boolean;
  permit_copy_status: string;
  destination_port: string;
  remarks: string;
  files: any;
}


