/**
 * TypeScript definitions for the P&L and Financial Tracker application.
 */

export interface RevenueClosure {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  packageDetails: string;
  packageCost: number; // inclusive of taxes/GST
  taxAmount: number; // Tax/GST Amount
  cashPaid: number; // Amount Paid till date
  remainingAmount: number; // calculated as packageCost - cashPaid
  nextInstallmentDate: string; // YYYY-MM-DD
  paymentType: 'EMI' | 'EQI' | 'ESAI' | 'Full Payment';
  closureDate: string; // YYYY-MM-DD
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Expense {
  id: string;
  userId: string;
  category: 'Salaries' | 'Marketing Ads' | 'Software Subscriptions' | 'Operations' | 'Infrastructure' | 'Miscellaneous' | 'Other';
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  
  // Marketing specific
  transactionId?: string;
  paymentMethod?: string;
  currency?: string;

  // Salary specific
  employeeName?: string;
  designation?: string;
  employmentType?: string;
  monthlySalary?: number;
  daysWorked?: number;
  paidThrough?: string; // Also shared with Infra/Misc

  // Infra / Misc Specific
  type?: string; 
  receiptImage?: string; // base64

  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface WorkingDaysConfig {
  monthYear: string; // YYYY-MM
  workingDays: number;
}

export interface PAndLStats {
  totalRevenue: number; // Cash Paid within selected period
  totalOutstanding: number; // Remaining Amount of all closures within selected period
  totalCosts: number; // Sum of expenses in period
  netProfitLossBeforeTax: number; // totalRevenue - totalCosts
  netProfitLossAfterTax: number; // totalRevenue - totalCosts - sum(taxes of closures in period)
  dailyBurnRate: number; // totalCosts / workingDays for the selected month
  totalWorkingDays: number;
}

export interface ChartDataPoint {
  name: string; // Year-Month or category, etc.
  [key: string]: string | number;
}

export interface CustomChartPayload {
  title: string;
  chartType: 'bar' | 'line' | 'pie' | 'composed' | 'radar';
  data: ChartDataPoint[];
  xAxisKey: string;
  series: {
    key: string;
    name: string;
    color: string;
  }[];
  explanation: string;
}
