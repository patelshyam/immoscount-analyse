import type { Metadata } from 'next';
import { Calculator } from './Calculator';

export const metadata: Metadata = { title: 'Calculator · immo-analyzer' };

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calculator</h1>
      <Calculator />
    </div>
  );
}
