import { userQueue, videoQueue } from '#start/websocket'
import { Socket } from 'socket.io'
import { UserInQueue } from './types.js'
import { randomUUID } from 'node:crypto'

export function disconnectUser(socket: Socket, partnerMap: Map<string, Socket>) {
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

export function makeMatch(
  socket: Socket,
  partner: UserInQueue | undefined,
  data: { peerId: string; chatType: string },
  partnerMap: Map<string, Socket>
) {
  if (partner?.socket.id === socket.id) return

  if (partner?.socket.connected) {
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
}

export function removeSocket(queue: typeof userQueue | typeof videoQueue, socket: Socket) {
  console.log(
    'queue before: ',
    queue.map((user: { socket: { id: string } }) => user.socket.id)
  )
  const index = queue.findIndex((user: { socket: { id: string } }) => user.socket.id === socket.id)

  queue.splice(index, 1)

  console.log(
    'queue after: ',
    queue.map((user: { socket: { id: string } }) => user.socket.id)
  )
}
