/**
 * @author tknight-dev
 */

export interface DoubleLinkedListNode<T> {
	data: T;
	next: DoubleLinkedListNode<T> | undefined;
	previous: DoubleLinkedListNode<T> | undefined;
}

export class DoubleLinkedList<T> {
	private end: DoubleLinkedListNode<T> | undefined = undefined;
	private start: DoubleLinkedListNode<T> | undefined = undefined;
	private _length: number = 0;

	/**
	 * Remove all nodes
	 */
	public clear(): void {
		let t = this;

		t.end = undefined;
		t._length = 0;
		t.start = undefined;
	}

	public getEnd(): DoubleLinkedListNode<T> | undefined {
		return this.end;
	}

	public getStart(): DoubleLinkedListNode<T> | undefined {
		return this.start;
	}

	public popEnd(): T | undefined {
		let t = this,
			end: DoubleLinkedListNode<T> | undefined = t.end;

		if (end) {
			if (t._length === 1) {
				t.end = undefined;
				t.start = undefined;
			} else {
				t.end = end.previous;
			}

			t._length--;
			return end.data;
		}

		return undefined;
	}

	public popStart(): T | undefined {
		let t = this,
			start: DoubleLinkedListNode<T> | undefined = t.start;

		if (start) {
			if (t._length === 1) {
				t.end = undefined;
				t.start = undefined;
			} else {
				t.start = start.next;
			}

			t._length--;
			return start.data;
		}

		return undefined;
	}

	public pushEnd(data: T): void {
		let t = this,
			node: DoubleLinkedListNode<T> = {
				data: data,
				next: undefined,
				previous: t._length ? t.end : undefined,
			};

		if (t.end) {
			t.end.next = node;
			t.end = node;
		} else {
			t.end = node;
			t.start = node;
		}

		t._length++;
	}

	public pushStart(data: T): void {
		let t = this,
			node: DoubleLinkedListNode<T> = {
				data: data,
				next: t._length ? t.start : undefined,
				previous: undefined,
			};

		if (t.start) {
			t.start.previous = node;
			t.start = node;
		} else {
			t.end = node;
			t.start = node;
		}

		t._length++;
	}

	public toArray(): T[] {
		let array: T[] = new Array(this._length),
			i: number = 0,
			node: DoubleLinkedListNode<T> | undefined = this.start;

		while (node) {
			array[i++] = node.data;
			node = node.next;
		}

		return array;
	}

	public get length(): number {
		return this._length;
	}

	public forEach(callback: (value: T) => void): void {
		let node: DoubleLinkedListNode<T> | undefined = this.start;
		while (node) {
			callback(node.data);
			node = node.next;
		}
	}

	// *[Symbol.iterator](): IterableIterator<DoubleLinkedListNode<T>> {
	// 	let node: DoubleLinkedListNode<T> | undefined = this.start;
	// 	while (node) {
	// 		yield node;
	// 		node = node.next;
	// 	}
	// }

	// *[Symbol.iterator](): IterableIterator<T> {
	// 	let data: T,
	// 		index: number = 0,
	// 		node: DoubleLinkedListNode<T> | undefined = this.start;

	// 	if(node && index < this._length) {
	// 		data = node.data;
	// 		node = node.next;
	// 		index++;
	// 		return {
	// 			done: false,
	// 			value: data
	// 		}
	// 	}else {
	// 		return {
	// 			done: true,
	// 			value: undefined,
	// 		};
	// 	}
	// }
}
