/* globals getAvatarSuggestionForUser */
import { RocketChatFile } from 'meteor/rocketchat:file';
<<<<<<< HEAD
=======
import { FileUpload } from 'meteor/rocketchat:file-upload';

>>>>>>> 9d7d2705b884d01ccff402c26cd9e38006181825
RocketChat.Migrations.add({
	version: 2,
	up() {
		return RocketChat.models.Users.find({
			avatarOrigin: {
				$exists: false,
			},
			username: {
				$exists: true,
			},
		}).forEach((user) => {
			const avatars = getAvatarSuggestionForUser(user);
			const services = Object.keys(avatars);

			if (services.length === 0) {
				return;
			}

			const service = services[0];

			console.log(user.username, '->', service);

			const dataURI = avatars[service].blob;
			const { image, contentType } = RocketChatFile.dataURIParse(dataURI);

			const rs = RocketChatFile.bufferToStream(new Buffer(image, 'base64'));
			const fileStore = FileUpload.getStore('Avatars');
			fileStore.deleteByName(user.username);

			const file = {
				userId: user._id,
				type: contentType,
			};

			fileStore.insert(file, rs, () => RocketChat.models.Users.setAvatarOrigin(user._id, service));
		});
	},
});
