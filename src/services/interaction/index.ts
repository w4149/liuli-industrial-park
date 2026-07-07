import { POI, Interaction, UserLocation } from '@/types'
import { locationService } from '@/services/location'

export interface InteractionEngine {
  checkTriggers: (location: UserLocation, pois: POI[]) => Interaction[]
  triggerInteraction: (interaction: Interaction, userId: string) => void
}

export const interactionEngine: InteractionEngine = {
  checkTriggers(location: UserLocation, pois: POI[]): Interaction[] {
    const triggered: Interaction[] = []

    pois.forEach((poi) => {
      const distance = locationService.calculateDistance(location, poi.coordinate)

      if (distance <= poi.radius) {
        poi.interactions.forEach((interaction) => {
          if (interaction.trigger_condition === 'enter') {
            triggered.push(interaction)
          }
        })
      }
    })

    return triggered
  },

  triggerInteraction(interaction: Interaction, userId: string) {
    console.log('Triggering interaction:', interaction.id, 'for user:', userId)

    if (interaction.reward) {
      console.log('Awarding reward:', interaction.reward)
    }
  },
}
