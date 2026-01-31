import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, DollarSign, Filter } from 'lucide-react';

// Specialized palette for stacked bars
const PALETTE = [
    '#6366f1', // Indigo 500
    '#0ea5e9', // Sky 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#ec4899', // Pink 500
    '#8b5cf6', // Violet 500
    '#ef4444', // Red 500
];

export default function Reports() {
    const [chartData, setChartData] = useState([]);
    const [costCenterKeys, setCostCenterKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalSpent, setTotalSpent] = useState(0);

    useEffect(() => {
        fetchReportData();
    }, []);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('view_expenses_summary')
                .select('*'); // service_name, cost_center_name, total_spent, month_year

            if (error) {
                console.error("Error fetching reports:", error);
            } else if (data) {
                processDataForStackChart(data);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    const processDataForStackChart = (rawData) => {
        // 1. Identify all unique Cost Centers (for the stack keys)
        const uniqueCostCenters = [...new Set(rawData.map(item => item.cost_center_name || 'Geral'))];
        setCostCenterKeys(uniqueCostCenters);

        // 2. Group by Service Name
        // Target format: { name: 'Service A', 'Cimento': 100, 'Aço': 200, total: 300 }
        const grouped = rawData.reduce((acc, curr) => {
            const serviceName = curr.service_name || 'Outros';
            const ccName = curr.cost_center_name || 'Geral';
            const amount = Number(curr.total_spent) || 0;

            if (!acc[serviceName]) {
                acc[serviceName] = { name: serviceName, total: 0 };
                // Initialize all keys to 0 for safety? Not strictly needed for Recharts but good valid data
            }

            acc[serviceName][ccName] = (acc[serviceName][ccName] || 0) + amount;
            acc[serviceName].total += amount;

            return acc;
        }, {});

        const processedArray = Object.values(grouped).sort((a, b) => b.total - a.total);
        setChartData(processedArray);
        setTotalSpent(rawData.reduce((acc, curr) => acc + (Number(curr.total_spent) || 0), 0));
    };


    if (loading) return (
        <div className="flex items-center justify-center h-full text-gray-500">
            <Loader2 className="animate-spin mr-2" /> Gerando relatórios...
        </div>
    );

    return (
        <div className="space-y-6 container mx-auto p-8 max-w-7xl">
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Despesas por Centro de Custo</h1>
                    <p className="text-gray-500 mt-1">Visão consolidada do mês atual</p>
                </div>

                <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Geral</p>
                    <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-end gap-1">
                        <span className="text-gray-400 text-lg">R$</span>
                        {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
            </div>

            {/* Main Chart Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                {chartData.length === 0 ? (
                    <div className="h-[400px] flex items-center justify-center text-gray-400">
                        Sem dados para exibir neste período.
                    </div>
                ) : (
                    <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    tickFormatter={(value) => `R$${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f9fafb' }}
                                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                                {/* Generate a Bar for each Cost Center Key found */}
                                {costCenterKeys.map((key, index) => (
                                    <Bar
                                        key={key}
                                        dataKey={key}
                                        stackId="a"
                                        fill={PALETTE[index % PALETTE.length]}
                                        radius={index === costCenterKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                        barSize={50}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Summary Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chartData.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-gray-800">{item.name}</h3>
                            <p className="text-xs text-gray-500">
                                {Object.keys(item).length - 2} Centros de Custo
                            </p>
                        </div>
                        <span className="font-bold text-gray-900 bg-gray-50 px-3 py-1 rounded">
                            R$ {item.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
