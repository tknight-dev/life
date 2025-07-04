var elementMenuInfo = <HTMLElement>document.getElementById('info-click');

elementMenuInfo.onclick = () => {
	(<any>window).open('https://tknight.dev/#/creations', '_blank').focus();
};
