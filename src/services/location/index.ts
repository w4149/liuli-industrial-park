import Taro from '@tarojs/taro'
import { UserLocation } from '@/types'

export interface LocationService {
  startTracking: (callback: (location: UserLocation) => void) => void
  stopTracking: () => void
  getCurrentLocation: () => Promise<UserLocation>
  calculateDistance: (loc1: UserLocation, loc2: { lat: number; lng: number }) => number
}

const EARTH_RADIUS = 6371000

export const locationService: LocationService = {
  startTracking(callback: (location: UserLocation) => void) {
    Taro.startLocationUpdate({
      success: () => {
        Taro.onLocationChange((res) => {
          callback({
            lat: res.latitude,
            lng: res.longitude,
            accuracy: res.accuracy,
            timestamp: Date.now(),
          })
        })
      },
      fail: (err) => {
        console.error('Failed to start location tracking:', err)
      },
    })
  },

  stopTracking() {
    Taro.stopLocationUpdate()
    Taro.offLocationChange()
  },

  async getCurrentLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
      Taro.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            lat: res.latitude,
            lng: res.longitude,
            accuracy: res.accuracy,
            timestamp: Date.now(),
          })
        },
        fail: reject,
      })
    })
  },

  calculateDistance(loc1: UserLocation, loc2: { lat: number; lng: number }): number {
    const radLat1 = (loc1.lat * Math.PI) / 180
    const radLat2 = (loc2.lat * Math.PI) / 180
    const deltaLat = radLat1 - radLat2
    const deltaLng = ((loc1.lng - loc2.lng) * Math.PI) / 180

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return EARTH_RADIUS * c
  },
}

export const ibeaconService = {
  startScanning: () => {
    Taro.startBeaconDiscovery({
      uuids: [],
      success: () => {
        Taro.onBeaconUpdate((res) => {
          console.log('iBeacon update:', res.beacons)
        })
      },
      fail: (err) => {
        console.warn('iBeacon scanning not available:', err)
      },
    })
  },

  stopScanning: () => {
    Taro.stopBeaconDiscovery()
    Taro.offBeaconUpdate()
  },
}
