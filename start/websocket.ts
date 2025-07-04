import WSocket from '#services/socket'
import app from '@adonisjs/core/services/app'
import { Socket } from 'socket.io'
import { SendMessageData, UserInQueue } from '#start/types'
import { randomUUID } from 'node:crypto'

const userQueue: UserInQueue[] = []
const videoQueue: UserInQueue[] = []
const partnerMap = new Map<string, Socket>()

app.ready(() => {
  WSocket.boot()
  const io = WSocket.io

  io?.on('connection', (socket: Socket) => {
    socket.emit('send-user-id', { userId: socket.id, isQueueing: true })

    // User Matching
    socket.on('find-partner', (data: { peerId: string; chatType: string }) => {
      console.log(socket.id, 'is looking for match.')

      if (userQueue.length > 0 || videoQueue.length > 0) {
        // Get the first user in queue and remove from the queue
        const partner = data.chatType === 'text' ? userQueue.shift() : videoQueue.shift()

        console.log('partner: ', partner?.socket.id)

        if (partner?.socket.id === socket.id) return

        if (partner?.socket.connected) {
          console.log(`partner connected`)
          const roomId = randomUUID()

          partnerMap.set(socket.id, partner.socket)
          partnerMap.set(partner.socket.id, socket)

          socket.join(roomId)
          partner.socket.join(roomId)

          socket.emit('matched', {
            roomId: roomId,
            partnerId: partner.socket.id,
            userPeerId: data.peerId,
            strangerPeerId: partner.peerId,
          })
          partner.socket.emit('matched', {
            roomId: roomId,
            partnerId: socket.id,
            userPeerId: partner.peerId,
            strangerPeerId: data.peerId,
          })
        }

        console.log(socket.id, 'is matched with', partner?.peerId)
      } else {
        // if queue is empty, push the current socket matching
        if (data.chatType === 'text') {
          userQueue.push({ socket, peerId: data.peerId })
        } else {
          videoQueue.push({ socket, peerId: data.peerId })
        }
        console.log(`${socket.id} added to queue.`)
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
      socket.emit('fire-disconnection', {})
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
