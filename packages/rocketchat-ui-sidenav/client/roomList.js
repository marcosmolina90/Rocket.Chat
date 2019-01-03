import { Meteor } from 'meteor/meteor';
import { RocketChat, UiTextContext } from 'meteor/rocketchat:lib';
import { Template } from 'meteor/templating';


async = function(name, callback){
	Meteor.call('loadroomlist', name, (err, results) => {
		console.log('ddddddddddddddd', results);
		var chats = results.rooms;
		var roles = results.roles;
		var rooms = [];
		for (let i = 0; i < chats.length; i++) {
			if(!chats[i].roles){
				rooms.push(chats[i]);
			}
		}


		for (let r = 0; r < roles.length; r++) {
			for (let i = 0; i < chats.length; i++) {
				if (chats[i].roles && chats[i].roles.includes(roles[r])) {
					chats[i].role = roles[r];
					rooms.push(chats[i]);
				}
			}
		}

		for (let i = 0; i < rooms.length; i++) {
			let showGroup = false;
			if (i === 0 || rooms[i].role !== rooms[i - 1].role) {
				showGroup = true;
			}
			rooms[i].showGroup = showGroup;
		}
		chatsResults = rooms;
		loading = false;
		//for(var d in chatsResults)
		//		RocketChat.models.ChatSubscription =  chatsResults;
		callback(chatsResults);
	});
}

Template.roomList.helpers({
	rooms() {
		console.log('marcos Template.roomList.helpers');
		/*
			modes:
				sortby activity/alphabetical
				merge channels into one list
				show favorites
				show unread
		*/
		if (this.anonymous) {
			return RocketChat.models.Rooms.find({ t: 'c' }, { sort: { name: 1 } });
		}

		const user = RocketChat.models.Users.findOne(Meteor.userId(), {
			fields: {
				'settings.preferences.sidebarSortby': 1,
				'settings.preferences.sidebarShowFavorites': 1,
				'settings.preferences.sidebarShowUnread': 1,
				'services.tokenpass': 1,
			},
		});

		const sortBy = RocketChat.getUserPreference(user, 'sidebarSortby') || 'alphabetical';
		const query = {
			open: true,
		};

		const sort = {};

		if (sortBy === 'Group') {
			var rs = [];
			var load =true;
			async(user.name, function(data){
				rs =  data;
				load = false;
			});
			delay(3000);
			/*while(load){
				setTimeout(function(){
					console.log('www')
				}, 3000);
			}*/
			return rs;
			
		} else {

			if (sortBy === 'activity') {
				sort.lm = -1;
			} else { // alphabetical
				sort[this.identifier === 'd' && RocketChat.settings.get('UI_Use_Real_Name') ? 'lowerCaseFName' : 'lowerCaseName'] = /descending/.test(sortBy) ? -1 : 1;
			}

			if (this.identifier === 'unread') {
				query.alert = true;
				query.hideUnreadStatus = { $ne: true };

				return ChatSubscription.find(query, { sort });
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



			if (sortBy === 'Group') {
				//var chat = ChatSubscription.findByUserIdGroup(user._id, {});
				var chat = ChatSubscription.find({}, {}).fetch();
				return chat;
			} else {
				var chat = ChatSubscription.find(query, { sort });
				return chat;
			}
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
			return `type-${room.header || room.identifier}`;
		}
	},

	noSubscriptionText() {
		const instance = Template.instance();
		return RocketChat.roomTypes.roomTypes[instance.data.identifier].getUiText(UiTextContext.NO_ROOMS_SUBSCRIBED) || 'No_channels_yet';
	},

	showRoomCounter() {
		return RocketChat.getUserPreference(Meteor.userId(), 'roomCounterSidebar');
	},

	role() {
		console.log('role', room);
		//RocketChat.user.findOne()
	}
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
	const room = RocketChat.models.Rooms.findOne(subscription.rid) || { _updatedAt: subscription.ts };
	subscription.lastMessage = room.lastMessage;
	subscription.lm = room._updatedAt;
	subscription.streamingOptions = room.streamingOptions;
	return Object.assign(subscription, getLowerCaseNames(subscription));
};

const mergeRoomSub = (room) => {
	const sub = RocketChat.models.Subscriptions.findOne({ rid: room._id });
	if (!sub) {
		return room;
	}

	RocketChat.models.Subscriptions.update({
		rid: room._id,
	}, {
			$set: {
				lastMessage: room.lastMessage,
				lm: room._updatedAt,
				streamingOptions: room.streamingOptions,
				...getLowerCaseNames(room, sub.name, sub.fname),
			},
		});

	return room;
};

RocketChat.callbacks.add('cachedCollection-received-rooms', mergeRoomSub);
RocketChat.callbacks.add('cachedCollection-sync-rooms', mergeRoomSub);
RocketChat.callbacks.add('cachedCollection-loadFromServer-rooms', mergeRoomSub);

RocketChat.callbacks.add('cachedCollection-received-subscriptions', mergeSubRoom);
RocketChat.callbacks.add('cachedCollection-sync-subscriptions', mergeSubRoom);
RocketChat.callbacks.add('cachedCollection-loadFromServer-subscriptions', mergeSubRoom);
