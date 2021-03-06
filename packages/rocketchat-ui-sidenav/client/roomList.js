import { Meteor } from 'meteor/meteor';
import { callbacks } from 'meteor/rocketchat:callbacks';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { ChatSubscription, Rooms, Users, Subscriptions } from 'meteor/rocketchat:models';
import { UiTextContext, getUserPreference, roomTypes } from 'meteor/rocketchat:utils';
import { settings } from 'meteor/rocketchat:settings';

/*	TODO Maxicon */
const getRooms = function(chats, callback) {
	Meteor.call('loadroomlist', chats, (err, results) => {
		callback(results);
	});
};

/*	TODO Maxicon */
Template.roomList.onCreated(function OnCreated() {
	const user = RocketChat.models.Users.findOne(Meteor.userId(), {
		fields: {
			'settings.preferences.sidebarSortby': 1,
			'settings.preferences.sidebarShowFavorites': 1,
			'settings.preferences.sidebarShowUnread': 1,
			'settings.preferences.sidebarGroupByRole': 1,
			'services.tokenpass': 1,
		},
	});
	Session.set('user', user);
	if (RocketChat.getUserPreference(user, 'sidebarGroupByRole')) {
		const chats = ChatSubscription.find({ open: true }).fetch();
		console.log('chats', chats);
		Meteor.call('loadroomlist', chats, (err, results) => {
			Session.set('rooms', results);
		});
	}
});

Template.roomList.helpers({
	/*	TODO Maxicon */
	list() {
		return Session.get('rooms');
	},
	rooms() {
		/*
			modes:
				sortby activity/alphabetical
				merge channels into one list
				show favorites
				show unread
		*/
		if (this.anonymous) {
			return Rooms.find({ t: 'c' }, { sort: { name: 1 } });
		}

		const user = RocketChat.models.Users.findOne(Meteor.userId(), {
			fields: {
				'settings.preferences.sidebarSortby': 1,
				'settings.preferences.sidebarShowFavorites': 1,
				'settings.preferences.sidebarShowUnread': 1,
				'settings.preferences.sidebarGroupByRole': 1,
				'services.tokenpass': 1,
			},
		});
		const sortBy = RocketChat.getUserPreference(user, 'sidebarSortby') || 'alphabetical';
		const query = {
			open: true,
		};

		const sort = {};
		/*	TODO Maxicon */
		if (RocketChat.getUserPreference(user, 'sidebarGroupByRole')) {
			const chats = ChatSubscription.find({ open: true }).fetch();
			getRooms(chats, function(data) {
				Session.set('rooms', data);
			});
			return chats;
		} else {
			if (sortBy === 'activity') {
				sort.lm = -1;
			} else { // alphabetical
				sort[this.identifier === 'd' && RocketChat.settings.get('UI_Use_Real_Name') ? 'lowerCaseFName' : 'lowerCaseName'] = /descending/.test(sortBy) ? -1 : 1;
			}

			if (this.identifier === 'unread') {
				query.alert = true;
				query.hideUnreadStatus = { $ne: true };
				const chats = ChatSubscription.find(query, { sort }).fetch();
				Session.set('rooms', chats);
				return chats;
			}

			const favoritesEnabled = !!(RocketChat.settings.get('Favorite_Rooms') && RocketChat.getUserPreference(user, 'sidebarShowFavorites'));

			if (this.identifier === 'f') {
				query.f = favoritesEnabled;
			} else {
				let types = [this.identifier];

				if (this.identifier === 'merged') {
					types = ['c', 'p', 'd'];
				}

				if (this.identifier === 'unread' || this.identifier === 'tokens') {
					types = ['c', 'p'];
				}

				if (['c', 'p'].includes(this.identifier)) {
					query.tokens = { $exists: false };
				} else if (this.identifier === 'tokens' && user && user.services && user.services.tokenpass) {
					query.tokens = { $exists: true };
				}

				if (RocketChat.getUserPreference(user, 'sidebarShowUnread')) {
					query.$or = [
						{ alert: { $ne: true } },
						{ hideUnreadStatus: true },
					];
				}
				query.t = { $in: types };
				if (favoritesEnabled) {
					query.f = { $ne: favoritesEnabled };
				}
			}
			const chats = ChatSubscription.find(query, { sort }).fetch();
			Session.set('rooms', chats);
			return chats;
		}
	},

	isLivechat() {
		return this.identifier === 'l';
	},

	shouldAppear(group, rooms) {
		/*
		if is a normal group ('channel' 'private' 'direct')
		or is favorite and has one room
		or is unread and has one room
		*/

		return !['unread', 'f'].includes(group.identifier) || (rooms.length || (rooms.count && rooms.count()));
	},

	roomType(room) {
		if (room.header || room.identifier) {
			return `type-${ room.header || room.identifier }`;
		}
	},

	noSubscriptionText() {
		const instance = Template.instance();
		return roomTypes.roomTypes[instance.data.identifier].getUiText(UiTextContext.NO_ROOMS_SUBSCRIBED) || 'No_channels_yet';
	},

	showRoomCounter() {
		return getUserPreference(Meteor.userId(), 'roomCounterSidebar');
	},
});

const getLowerCaseNames = (room, nameDefault = '', fnameDefault = '') => {
	const name = room.name || nameDefault;
	const fname = room.fname || fnameDefault || name;
	return {
		lowerCaseName: name.toLowerCase(),
		lowerCaseFName: fname.toLowerCase(),
	};
};

const mergeSubRoom = (subscription) => {
	const room = Rooms.findOne(subscription.rid) || { _updatedAt: subscription.ts };
	subscription.lastMessage = room.lastMessage;
	subscription.lm = room._updatedAt;
	subscription.streamingOptions = room.streamingOptions;
	return Object.assign(subscription, getLowerCaseNames(subscription));

};

const mergeRoomSub = (room) => {
	const sub = Subscriptions.findOne({ rid: room._id });
	if (!sub) {
		return room;
	}

	Subscriptions.update({
		rid: room._id,
	},
	{
		$set: {
			lastMessage: room.lastMessage,
			lm: room._updatedAt,
			streamingOptions: room.streamingOptions,
			...getLowerCaseNames(room, sub.name, sub.fname),
		},
	});
	return room;
};

callbacks.add('cachedCollection-received-rooms', mergeRoomSub);
callbacks.add('cachedCollection-sync-rooms', mergeRoomSub);
callbacks.add('cachedCollection-loadFromServer-rooms', mergeRoomSub);

callbacks.add('cachedCollection-received-subscriptions', mergeSubRoom);
callbacks.add('cachedCollection-sync-subscriptions', mergeSubRoom);
callbacks.add('cachedCollection-loadFromServer-subscriptions', mergeSubRoom);
