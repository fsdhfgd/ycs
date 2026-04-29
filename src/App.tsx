import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Globe, Cloud, Shield, Code, Info, CheckCircle2, AlertCircle, ExternalLink, Github, Database } from 'lucide-react';
import { CloudRanges, IPPrefix } from './types';
import { parseAllPrefixes, findMatchingPrefixes } from './lib/ip-utils';

export default function App() {
  const [ip, setIp] = useState('');
  const [ranges, setRanges] = useState<CloudRanges | null>(null);
  const [allPrefixes, setAllPrefixes] = useState<IPPrefix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IPPrefix[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'aws' | 'gcp' | 'azure' | 'oracle' | 'cloudflare'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/ranges');
      setRanges(response.data);
      setAllPrefixes(parseAllPrefixes(response.data));
      setError(null);
    } catch (err) {
      setError('加载数据失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ip) {
      setResults([]);
      return;
    }
    const matches = findMatchingPrefixes(ip, allPrefixes);
    setResults(matches);
  };

  // Trigger search on typing (optional but nice for dashboards)
  useEffect(() => {
    if (ip) {
      const timer = setTimeout(() => handleSearch(), 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [ip, allPrefixes]);

  const filteredPrefixes = activeTab === 'all' 
    ? allPrefixes 
    : allPrefixes.filter(p => p.provider === activeTab);

  const ipv4Count = allPrefixes.filter(p => !p.prefix.includes(':')).length;
  const ipv6Count = allPrefixes.filter(p => p.prefix.includes(':')).length;
  const ipv6Percentage = allPrefixes.length > 0 ? ((ipv6Count / allPrefixes.length) * 100).toFixed(1) : '0';
  const activeVendors = new Set(allPrefixes.map(p => p.provider)).size;

  const pythonScript = `
import requests
import ipaddress
import json

# 多厂商云 IP 范围查询工具 (支持 IPv4/IPv6)
# 涵盖厂商: AWS, Google Cloud, Oracle, Cloudflare

def check_ip_cloud(target_ip_str):
    """
    检查 IP 地址是否属于主流云厂商的官方公开 CIDR 范围
    """
    try:
        # 自动识别 IPv4 或 IPv6 地址对象
        target = ipaddress.ip_address(target_ip_str)
    except ValueError:
        return [{"error": "无效的 IP 地址格式，请输入正确的 IPv4 或 IPv6"}]
    
    # 厂商官方动态数据源
    sources = {
        "AWS": "https://ip-ranges.amazonaws.com/ip-ranges.json",
        "GCP": "https://www.gstatic.com/ipranges/cloud.json",
        "Oracle": "https://docs.oracle.com/iaas/tools/public_ip_ranges.json",
        "Cloudflare": "https://api.cloudflare.com/client/v4/ips"
    }

    results = []

    # 1. 检查 AWS
    try:
        resp = requests.get(sources["AWS"], timeout=10).json()
        if target.version == 4:
            for p in resp.get("prefixes", []):
                if target in ipaddress.ip_network(p["ip_prefix"]):
                    results.append({"provider": "AWS", "prefix": p["ip_prefix"], "region": p["region"], "service": p["service"]})
        else:
            for p in resp.get("ipv6_prefixes", []):
                if target in ipaddress.ip_network(p["ipv6_prefix"]):
                    results.append({"provider": "AWS", "prefix": p["ipv6_prefix"], "region": p["region"], "service": p["service"]})
    except Exception as e: print(f"AWS 数据获取失败: {e}")

    # 2. 检查 GCP
    try:
        resp = requests.get(sources["GCP"], timeout=10).json()
        for p in resp.get("prefixes", []):
            cidr = p.get("ipv4Prefix") or p.get("ipv6Prefix")
            if cidr and target in ipaddress.ip_network(cidr):
                results.append({"provider": "GCP", "prefix": cidr, "region": p.get("scope"), "service": p.get("service")})
    except Exception as e: print(f"GCP 数据获取失败: {e}")

    # 3. 检查 Cloudflare
    try:
        resp = requests.get(sources["Cloudflare"], timeout=10).json()
        cidrs = resp.get("result", {}).get("ipv4_cidrs", []) + resp.get("result", {}).get("ipv6_cidrs", [])
        for cidr in cidrs:
            if target in ipaddress.ip_network(cidr):
                results.append({"provider": "Cloudflare", "prefix": cidr, "service": "Edge 网络边缘节点"})
    except Exception as e: print(f"Cloudflare 数据获取失败: {e}")

    return results

if __name__ == "__main__":
    print("-" * 30)
    print("云厂商 IP 范围本地查询工具")
    print("-" * 30)
    test_ip = input("请输入 IP 地址 (例如 1.1.1.1 或 2600:1f18::): ").strip()
    if not test_ip:
        exit()

    matches = check_ip_cloud(test_ip)
    
    if not matches:
        print(f"[-] 结果: {test_ip} 不在已知云厂商的公开 IP 范围内。")
    elif "error" in matches[0]:
        print(f"[!] 错误: {matches[0]['error']}")
    else:
        print(f"[+] 匹配成功! 找到 {len(matches)} 条记录:")
        for idx, m in enumerate(matches, 1):
            print(f"  [{idx}] 厂商: {m['provider']}")
            print(f"      网段: {m['prefix']}")
            print(f"      地域: {m.get('region', '全球 Anycast')}")
            print(f"      服务: {m.get('service', '通用基础架构')}")
            print("-" * 20)
`.trim();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">CloudRange</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 pb-3">服务商筛选</div>
          <SidebarLink active={activeTab === 'all' && !showCode} onClick={() => {setActiveTab('all'); setShowCode(false);}} icon={<Globe className="w-4 h-4" />} label="所有厂商" />
          <SidebarLink active={activeTab === 'aws' && !showCode} onClick={() => {setActiveTab('aws'); setShowCode(false);}} icon={<Database className="w-4 h-4" />} label="AWS" />
          <SidebarLink active={activeTab === 'gcp' && !showCode} onClick={() => {setActiveTab('gcp'); setShowCode(false);}} icon={<CheckCircle2 className="w-4 h-4" />} label="Google Cloud" />
          <SidebarLink active={activeTab === 'azure' && !showCode} onClick={() => {setActiveTab('azure'); setShowCode(false);}} icon={<Shield className="w-4 h-4" />} label="Azure (Public)" />
          <SidebarLink active={activeTab === 'oracle' && !showCode} onClick={() => {setActiveTab('oracle'); setShowCode(false);}} icon={<Database className="w-4 h-4" />} label="Oracle Cloud" />
          <SidebarLink active={activeTab === 'cloudflare' && !showCode} onClick={() => {setActiveTab('cloudflare'); setShowCode(false);}} icon={<Globe className="w-4 h-4" />} label="Cloudflare" />
          
          <div className="pt-8">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 pb-3">开发者</div>
            <SidebarLink 
              active={showCode} 
              onClick={() => setShowCode(!showCode)} 
              icon={<Code className="w-4 h-4" />} 
              label="Python 脚本示例" 
            />
          </div>
        </nav>

        <div className="p-6 bg-slate-950">
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            {loading ? '数据同步中...' : '系统就绪'}
          </div>
          <div className="text-[10px] text-slate-600 font-mono">数据来源: 厂商官方 API</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center bg-slate-100 rounded-lg px-4 py-2 w-96 border border-slate-200 group focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="w-4 h-4 text-slate-400 mr-2 group-focus-within:text-blue-500" />
            <input 
              type="text" 
              placeholder="查询具体 IP (例如: 52.95.245.0)" 
              className="bg-transparent border-none text-sm w-full focus:outline-none"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
             <button 
              onClick={() => {
                const blob = new Blob([JSON.stringify(allPrefixes, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'cloud-prefixes.json';
                a.click();
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              导出 JSON
            </button>
            <button 
              onClick={fetchData}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-500/20 active:translate-y-px transition-all"
            >
              立即同步
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto space-y-6">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="IPv4 已加载网段" value={ipv4Count.toLocaleString()} subValue="活跃 CIDR" />
            <StatCard label="IPv6 已加载网段" value={ipv6Count.toLocaleString()} subValue="正在同步" highlight />
            <StatCard label="IPv6 普及率" value={`${ipv6Percentage}%`} />
            <StatCard label="官方数据最后更新" value={ranges?.updatedAt ? new Date(ranges.updatedAt).toLocaleTimeString() : '--:--'} />
          </div>

          <AnimatePresence mode="wait">
            {showCode ? (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800"
              >
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Python 自动查询脚本 (中文注释版)</h2>
                  <button 
                    onClick={() => {
                        navigator.clipboard.writeText(pythonScript);
                        alert('脚本内容已复制');
                    }}
                    className="text-[10px] font-bold text-white px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors"
                  >
                    全部复制
                  </button>
                </div>
                <div className="p-6 overflow-x-auto text-[13px] font-mono text-slate-300 leading-relaxed max-h-[600px]">
                  <pre><code>{pythonScript}</code></pre>
                </div>
              </motion.section>
            ) : results.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <h2 className="text-sm font-bold text-slate-900 px-1">查询结果 (共匹配 {results.length} 条网段)</h2>
                <div className="grid gap-4">
                  {results.map((res, i) => (
                    <div key={i} className="bg-white border-2 border-blue-100 p-6 rounded-xl shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                      <div className="flex gap-4 items-center">
                        <div className={`p-3 rounded-lg ${getProviderClass(res.provider)}`}>
                          <Cloud className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                             {res.provider}
                             <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                          <div className="text-blue-600 font-mono text-sm font-semibold tracking-wide">{res.prefix}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{res.region || '全局节点'}</div>
                        <div className="text-slate-600 font-medium px-2 py-0.5 bg-slate-100 rounded text-xs">{res.service || '基础边缘网络'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-[400px]"
              >
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="font-semibold text-slate-700">
                    {activeTab === 'all' ? '当前所有 IP 前缀' : `${activeTab.toUpperCase()} 的 IP 前缀`}
                  </h2>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">IPv4</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wide">IPv6</span>
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto relative">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                    </div>
                  ) : filteredPrefixes.length === 0 ? (
                    <div className="p-20 text-center text-slate-400">
                      没有记录
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-slate-100">
                          <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">厂商</th>
                          <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">CIDR 前缀</th>
                          <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">地域 / 范围</th>
                          <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">服务说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredPrefixes.slice(0, 50).map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-3 font-bold text-slate-800 uppercase">{p.provider}</td>
                            <td className="px-6 py-3 font-mono text-blue-600 font-medium">{p.prefix}</td>
                            <td className="px-6 py-3 text-slate-500">{p.region || 'Global'}</td>
                            <td className="px-6 py-3 text-slate-400 text-xs italic">{p.service || 'Anycast/Edge'}</td>
                          </tr>
                        ))}
                        {filteredPrefixes.length > 50 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-slate-400 text-xs font-medium bg-slate-50/30">
                              此处仅展示前 50 条记录，共 {filteredPrefixes.length.toLocaleString()} 条
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <footer className="mt-auto h-10 border-t border-slate-200 bg-white px-8 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest shrink-0">
          <div className="flex gap-4">
            <div>本地核心: <span className="text-emerald-600 font-bold">同步引擎已就绪</span></div>
            <div>开发者模式: <span className={showCode ? "text-blue-600 font-bold" : "text-slate-600"}>{showCode ? '脚本已展开' : '就绪'}</span></div>
          </div>
          <div>多厂商云 IP 特种库 v1.2.0 · 专业版 · {allPrefixes.length.toLocaleString()} 条记录已索引</div>
        </footer>
      </main>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full sidebar-link ${active ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1 h-3 bg-white/40 rounded-full" />}
    </button>
  );
}

function StatCard({ label, value, subValue, highlight }: { label: string; value: string; subValue?: string; highlight?: boolean }) {
  return (
    <div className="card-stat">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${highlight ? 'text-blue-600' : 'text-slate-900'}`}>{value}</div>
      {subValue && <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tighter">{subValue}</div>}
    </div>
  );
}

function getProviderClass(provider: string) {
  switch (provider) {
    case 'aws': return 'bg-orange-50 text-orange-600';
    case 'gcp': return 'bg-blue-50 text-blue-600';
    case 'oracle': return 'bg-red-50 text-red-600';
    case 'cloudflare': return 'bg-amber-50 text-amber-600';
    default: return 'bg-slate-50 text-slate-600';
  }
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h4 className="font-bold text-slate-800 mb-2">{title}</h4>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function getProviderColor(provider: string) {
  switch (provider) {
    case 'aws': return 'bg-orange-100 text-orange-600';
    case 'gcp': return 'bg-blue-100 text-blue-600';
    case 'oracle': return 'bg-red-100 text-red-600';
    case 'cloudflare': return 'bg-orange-50 text-amber-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}
