/* globals RocketChat */
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
<<<<<<< HEAD
=======
import { RocketChat } from 'meteor/rocketchat:lib';
import { hasPermission } from 'meteor/rocketchat:authorization';
>>>>>>> 9d7d2705b884d01ccff402c26cd9e38006181825

Meteor.methods({
	eraseRoom(rid) {
		check(rid, String);

		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'eraseRoom',
			});
		}

		const room = RocketChat.models.Rooms.findOneById(rid);

		if (!room) {
			throw new Meteor.Error('error-invalid-room', 'Invalid room', {
				method: 'eraseRoom',
			});
		}

		if (Apps && Apps.isLoaded()) {
			const prevent = Promise.await(Apps.getBridges().getListenerBridge().roomEvent('IPreRoomDeletePrevent', room));
			if (prevent) {
				throw new Meteor.Error('error-app-prevented-deleting', 'A Rocket.Chat App prevented the room erasing.');
			}
		}

		if (!RocketChat.roomTypes.roomTypes[room.t].canBeDeleted(hasPermission, room)) {
			throw new Meteor.Error('error-not-allowed', 'Not allowed', {
				method: 'eraseRoom',
			});
		}

		RocketChat.models.Messages.removeFilesByRoomId(rid);
		RocketChat.models.Messages.removeByRoomId(rid);
		RocketChat.models.Subscriptions.removeByRoomId(rid);
		const result = RocketChat.models.Rooms.removeById(rid);

		if (Apps && Apps.isLoaded()) {
			Apps.getBridges().getListenerBridge().roomEvent('IPostRoomDeleted', room);
		}

		return result;
	},
});
