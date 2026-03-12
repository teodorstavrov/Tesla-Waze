import { create } from 'zustand'
import { Route, RouteMode, LatLng, RouteWaypoint } from '../types'

interface RouteState {
  origin: RouteWaypoint | null
  destination: RouteWaypoint | null
  routes: Route[]
  activeRoute: Route | null
  activeMode: RouteMode
  isNavigating: boolean
  isCalculating: boolean
  searchQuery: string

  setOrigin: (o: RouteWaypoint | null) => void
  setDestination: (d: RouteWaypoint | null) => void
  setRoutes: (routes: Route[]) => void
  setActiveRoute: (route: Route | null) => void
  setActiveMode: (mode: RouteMode) => void
  setNavigating: (v: boolean) => void
  setCalculating: (v: boolean) => void
  setSearchQuery: (q: string) => void
  clearRoute: () => void
}

export const useRouteStore = create<RouteState>((set) => ({
  origin: null,
  destination: null,
  routes: [],
  activeRoute: null,
  activeMode: 'fastest',
  isNavigating: false,
  isCalculating: false,
  searchQuery: '',

  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setRoutes: (routes) => set({ routes, activeRoute: routes[0] ?? null }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setActiveMode: (activeMode) => set({ activeMode }),
  setNavigating: (isNavigating) => set({ isNavigating }),
  setCalculating: (isCalculating) => set({ isCalculating }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearRoute: () => set({
    origin: null, destination: null, routes: [], activeRoute: null,
    isNavigating: false, isCalculating: false, searchQuery: ''
  })
}))
