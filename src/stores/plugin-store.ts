import { create } from 'zustand'
import type { SidebarTabDef, StatusBarItemDef, CommandDef } from '../types/plugin'

interface PluginStoreState {
  sidebarTabs: SidebarTabDef[]
  statusBarItems: StatusBarItemDef[]
  commands: CommandDef[]

  addSidebarTab: (tab: SidebarTabDef) => () => void
  addStatusBarItem: (item: StatusBarItemDef) => () => void
  registerCommand: (cmd: CommandDef) => void
}

export const usePluginStore = create<PluginStoreState>((set) => ({
  sidebarTabs: [],
  statusBarItems: [],
  commands: [],

  addSidebarTab: (tab) => {
    set((s) => ({ sidebarTabs: [...s.sidebarTabs, tab] }))
    return () => {
      set((s) => ({ sidebarTabs: s.sidebarTabs.filter((t) => t.id !== tab.id) }))
    }
  },

  addStatusBarItem: (item) => {
    set((s) => ({
      statusBarItems: [...s.statusBarItems.filter((i) => i.id !== item.id), item],
    }))
    return () => {
      set((s) => ({ statusBarItems: s.statusBarItems.filter((i) => i.id !== item.id) }))
    }
  },

  registerCommand: (cmd) => {
    set((s) => {
      if (s.commands.find((c) => c.id === cmd.id)) return s
      return { commands: [...s.commands, cmd] }
    })
  },
}))
