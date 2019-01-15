import { RocketChat } from 'meteor/rocketchat:lib';
import _ from 'underscore';
import { Promise } from 'meteor/promise';

if (_.isUndefined(RocketChat.models.Subscriptions)) {
	RocketChat.models.Subscriptions = {};
}

Object.assign(RocketChat.models.Subscriptions, {
	findOnGroup() {
		console.log('findOnGroup');
		let chats =  this.find({open : true}).fetch();
		const notGroup = ['user', 'bot', 'guest', 'admin', 'livechat-agent', 'livechat-guest'];
	
		for (let i = 0; i < chats.length; i++) {
			if (chats[i].name) {
				var usrs = null;
				
				 Meteor.call('validateReceipt', chats[i].name, (error, result) => {
					if (error) reject(error);
					usrs = result;
				  });
				console.log(usrs);
				
				//usrs = RocketChat.models.Users.find(chats[i].name, { fields: { roles : 1 } }).fetch();
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
		return rooms;
	},
	isUserInRole(userId, roleName, roomId) {
		if (roomId == null) {
			return false;
		}

		const query = {
			rid: roomId,
			roles: roleName,
		};

		return !_.isUndefined(this.findOne(query));
	},

	findUsersInRoles(roles, scope, options) {
		roles = [].concat(roles);

		const query = {
			roles: { $in: roles },
		};

		if (scope) {
			query.rid = scope;
		}

		const subscriptions = this.find(query).fetch();

		const users = _.compact(_.map(subscriptions, function(subscription) {
			if ('undefined' !== typeof subscription.u && 'undefined' !== typeof subscription.u._id) {
				return subscription.u._id;
			}
		}));

		return RocketChat.models.Users.find({ _id: { $in: users } }, options);
	},
});
