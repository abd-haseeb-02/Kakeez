"use client"

import { useState } from "react"
import { Settings, Save, Globe, Shield, CreditCard, Bell, Palette } from "lucide-react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general")

  const tabs = [
    { id: "general", label: "General", icon: Globe },
    { id: "security", label: "Security", icon: Shield },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold ff-accia text-primary-brown">Settings</h1>
        <p className="text-white/50 ff-apfel mt-1">Configure your bakeshop's preferences and security.</p>
      </div>

      <div className="flex gap-10">
        {/* Tabs Sidebar */}
        <aside className="w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ff-apfel text-sm ${
                activeTab === tab.id 
                  ? "bg-primary-brown text-white shadow-lg shadow-primary-brown/20" 
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Tab Content */}
        <main className="flex-1 bg-[#121212] border border-white/5 rounded-3xl p-10">
          {activeTab === "general" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold ff-accia text-white">General Settings</h2>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm text-white/30 ff-apfel">Shop Name</label>
                  <input 
                    defaultValue="KAKEEZ Bakeshop"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white ff-apfel" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/30 ff-apfel">Contact Email</label>
                  <input 
                    defaultValue="orders@kakeez.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white ff-apfel" 
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-sm text-white/30 ff-apfel">Shop Address</label>
                  <textarea 
                    defaultValue="9998 Hayes Isle, Mantefurt 03581"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white ff-apfel h-32" 
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 flex justify-end">
                <button className="flex items-center gap-2 bg-primary-brown text-white px-8 py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold">
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold ff-accia text-white">Payments</h2>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-3 ff-apfel text-amber-300 font-bold uppercase text-xs tracking-widest">
                  <CreditCard size={18} />
                  Cash on Delivery only — at launch
                </div>
                <p className="ff-apfel text-white/70 leading-relaxed">
                  Online payment providers (Card, JazzCash, Easypaisa) are not enabled yet. To enable them, contact engineering.
                </p>
                <p className="ff-apfel text-white/50 text-sm leading-relaxed">
                  COD-specific controls — daily order caps, first-order value limit, blocklist — will live under <span className="text-primary-brown">Operations → COD Risk</span>.
                </p>
              </div>
            </div>
          )}

          {activeTab !== "general" && activeTab !== "payments" && (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
               {(() => {
                 const currentTab = tabs.find(t => t.id === activeTab)
                 if (!currentTab) return null
                 const Icon = currentTab.icon
                 return <Icon size={64} className="mb-4" />
               })()}
               <p className="ff-accia text-xl">Module Coming Soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
