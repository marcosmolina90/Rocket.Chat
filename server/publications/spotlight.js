import { Meteor } from 'meteor/meteor';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import s from 'underscore.string';

function fetchRooms(userId, rooms) {
	if (!RocketChat.settings.get('Store_Last_Message') || RocketChat.authz.hasPermission(userId, 'preview-c-room')) {
		return rooms;
	}

	return rooms.map((room) => {
		delete room.lastMessage;
		return room;
	});
}

Meteor.methods({
	'getUserRoom'(name) {
		return RocketChat.models.Users.findByUsername(name, { fields: { roles : 1 } }).fetch();
	},
	loadroomlist(chats) {
		const notGroup = ['user', 'bot', 'guest', 'admin', 'livechat-agent', 'livechat-guest'];
		const roles = [];
		for (let i = 0; i < chats.length; i++) {
			if (chats[i].name) {
				let usr = {};
				const usrs = RocketChat.models.Users.findByUsername(chats[i].name, { fields: { roles : 1 } }).fetch();
				if (usrs && usrs[0]) {
					usr = usrs[0];
				}
				if (usr && usr.roles) {
					chats[i].roles = usr.roles;
					for (let r = 0; r < usr.roles.length; r++) {
						if (!roles.includes(usr.roles[r]) && !notGroup.includes(usr.roles[r])) {
							roles.push(usr.roles[r]);
						}
					}
				}
			}
		}
		roles.sort();
		const rooms = [];
		for (let i = 0; i < chats.length; i++) {
			if (chats[i].rid && (!chats[i].roles || (chats[i].roles && chats[i].roles.length === 0))) {
				rooms.push(chats[i]);
			}
		}


		for (let r = 0; r < roles.length; r++) {
			for (let i = 0; i < chats.length; i++) {
				if (chats[i].roles && chats[i].roles.includes(roles[r])  && !rooms.includes(chats[i])) {
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
		return rooms;
	},
	spotlight(text, usernames, type = { users: true, rooms: true }, rid) {
		const searchForChannels = text[0] === '#';
		const searchForDMs = text[0] === '@';
		if (searchForChannels) {
			type.users = false;
			text = text.slice(1);
		}
		if (searchForDMs) {
			type.rooms = false;
			text = text.slice(1);
		}
		const regex = new RegExp(s.trim(s.escapeRegExp(text)), 'i');
		const result = {
			users: [],
			rooms: [],
		};
		const roomOptions = {
			limit: 100,
			fields: {
				t: 1,
				name: 1,
				joinCodeRequired: 1,
				lastMessage: 1,
			},
			sort: {
				name: 1,
			},
		};
		const { userId } = this;
		if (userId == null) {
			if (RocketChat.settings.get('Accounts_AllowAnonymousRead') === true) {
				result.rooms = fetchRooms(userId, RocketChat.models.Rooms.findByNameAndTypeNotDefault(regex, 'c', roomOptions).fetch());
			}
			return result;
		}
		const userOptions = {
			limit: 300,
			fields: {
				username: 1,
				name: 1,
				status: 1,
				roles: 1,
			},
			sort: {},
		};
		if (RocketChat.settings.get('UI_Use_Real_Name')) {
			userOptions.sort.name = 1;
		} else {
			userOptions.sort.username = 1;
		}

		if (RocketChat.authz.hasPermission(userId, 'view-only-group')
			&& !RocketChat.authz.hasPermission(userId, 'view-outside-room')) {
			const user = RocketChat.models.Users.find({ _id: userId }).fetch();
			result.users = RocketChat.models.Users.findByActiveUsersGroupExcept(text, user[0].roles, usernames, userOptions).fetch();
			return result;
		}


		if (RocketChat.authz.hasPermission(userId, 'view-outside-room')) {
			if (type.users === true && RocketChat.authz.hasPermission(userId, 'view-d-room')) {
				result.users = RocketChat.models.Users.findByActiveUsersExcept(text, usernames, userOptions).fetch();
			}

			if (type.rooms === true && RocketChat.authz.hasPermission(userId, 'view-c-room')) {
				const searchableRoomTypes = Object.entries(RocketChat.roomTypes.roomTypes)
					.filter((roomType) => roomType[1].includeInRoomSearch())
					.map((roomType) => roomType[0]);

				const roomIds = RocketChat.models.Subscriptions.findByUserIdAndTypes(userId, searchableRoomTypes, { fields: { rid: 1 } }).fetch().map((s) => s.rid);
				result.rooms = fetchRooms(userId, RocketChat.models.Rooms.findByNameAndTypesNotInIds(regex, searchableRoomTypes, roomIds, roomOptions).fetch());
			}
		} else if (type.users === true && rid) {
			const subscriptions = RocketChat.models.Subscriptions.find({
				rid, 'u.username': {
					$regex: regex,
					$nin: [...usernames, Meteor.user().username],
				},
			}, { limit: userOptions.limit }).fetch().map(({ u }) => u._id);
			result.users = RocketChat.models.Users.find({ _id: { $in: subscriptions } }, {
				fields: userOptions.fields,
				sort: userOptions.sort,
			}).fetch();
		}

		return result;
	},
});

DDPRateLimiter.addRule({
	type: 'method',
	name: 'spotlight',
	userId(/* userId*/) {
		return true;
	},
}, 100, 100000);
