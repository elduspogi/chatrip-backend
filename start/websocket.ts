import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData } from '#start/types'
import { randomUUID } from 'node:crypto'

const userQueue: Socket[] = []
const partnerMap = new Map<string, Socket>()

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    socket.emit('send-user-id', { userId: socket.id, isQueueing: true })

    // User Matching
    socket.on('find-partner', () => {
      if (userQueue.length > 0) {
        // Get the first user in queue and remove from the queue
        const partner = userQueue.shift()

        if (partner === socket) return

        if (partner?.connected) {
          const roomId = randomUUID()

          partnerMap.set(socket.id, partner)
          partnerMap.set(partner.id, socket)

          socket.join(roomId)
          partner.join(roomId)

          socket.emit('matched', { roomId: roomId, partnerId: partner.id, isQueueing: false })
          partner.emit('matched', { roomId: roomId, partnerId: socket.id, isQueueing: false })
        }
      } else {
        // if queue is empty, push the current socket matching
        userQueue.push(socket)
      }
    })

    // Listen for chats from the client
    socket.on('send-message', async (data: SendMessageData) => {
      const timeout = 100

      try {
        await new Promise((res) => setTimeout(res, timeout))

        io.to(data.roomId!).emit('ping', { userId: data.userId, message: data.message })
      } catch (err) {
        console.log('Error: ', err)
      }
    })

    // Listen for typing events from the client
    socket.on('fire-typing', (data: { userId: string; roomId: string; isTyping: boolean }) => {
      socket.to(data.roomId).emit('fire-typing', { userId: data.userId, isTyping: data.isTyping })
    })

    // FOR REMOVAL (DON'T MIND THIS HEHE)
    // KINDA SUS
    socket.on('fire-disconnection', () => {
      disconnectUser(socket)
    })

    // Listen for client disconnection
    socket.on('disconnect', () => {
      disconnectUser(socket)
    })
  })
})

function disconnectUser(socket: Socket) {
  const partner = partnerMap.get(socket.id)

  if (partner) {
    socket.emit('notify-disconnection', { userId: socket.id, isDisconnected: true })
    partner.emit('notify-disconnection', { userId: socket.id, isDisconnected: true })

    socket.emit('send-user-id', { userId: socket.id, isQueueing: false })
    partner.emit('send-user-id', { userId: partner.id, isQueueing: false })

    partnerMap.delete(socket.id)
    partnerMap.delete(partner.id)
  }
}
