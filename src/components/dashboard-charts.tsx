"use client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#059669",
  COMPLETED: "#2563eb",
  DEFAULTED: "#dc2626",
  RESTRUCTURED: "#7c3aed",
  PENDING: "#d97706",
  REJECTED: "#94a3b8",
};

export function DashboardCharts({
  contributionsGrowth,
  loanPortfolio,
  departmentSavings,
}: {
  contributionsGrowth: { month: string; savings: number }[];
  loanPortfolio: { status: string; count: number }[];
  departmentSavings: { department: string; savings: number }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Savings collected per month</CardTitle>
        </CardHeader>
        <CardContent className="h-72 p-4 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={contributionsGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₦${Number(v).toLocaleString()}`, "Savings posted"]} />
              <Line type="monotone" dataKey="savings" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} name="Savings posted" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan portfolio composition</CardTitle>
        </CardHeader>
        <CardContent className="h-72 p-4 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={loanPortfolio} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                {loanPortfolio.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [String(v), "Loans"]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Savings by department</CardTitle>
        </CardHeader>
        <CardContent className="h-80 p-4 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentSavings} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="department" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`₦${Number(v).toLocaleString()}`, "Total savings"]} />
              <Bar dataKey="savings" fill="#059669" name="Total savings" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
