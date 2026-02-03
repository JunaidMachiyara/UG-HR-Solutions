import React, { useState, useEffect, useRef } from 'react';
import { Item, PackingType } from '../../types.ts';

interface ItemSelectorProps {
  items: Item[];
  selectedItemId: string;
  onSelect: (itemId: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}

const ItemSelector: React.FC<ItemSelectorProps> = ({ items, selectedItemId, onSelect, inputRef, placeholder = "Type ID or Name..." }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const getItemDisplayText = (item: Item | null | undefined): string => {
    if (!item) return '';
    let text = `${item.id} - ${item.name}`;
    if (item.packingType === PackingType.Bales && item.baleSize > 0) {
        text += ` (${item.baleSize} Kg)`;
    }
    return text;
  };

  useEffect(() => {
    const selectedItem = items.find(item => item.id === selectedItemId);
    setInputValue(getItemDisplayText(selectedItem));
  }, [selectedItemId, items]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const currentSelection = items.find(item => getItemDisplayText(item) === inputValue);
        if (!currentSelection) {
            const selectedItem = items.find(item => item.id === selectedItemId);
            setInputValue(getItemDisplayText(selectedItem));
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, inputValue, items, selectedItemId]);

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    
    const highlightedItem = listRef.current.children[highlightedIndex] as HTMLLIElement;
    if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [highlightedIndex]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [inputValue]);
  
  const filteredItems = items.filter(item => 
    getItemDisplayText(item).toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (item: Item) => {
    onSelect(item.id);
    setInputValue(getItemDisplayText(item));
    setIsOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    if (e.target.value === '') {
        onSelect('');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
            break;
        case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
            break;
        case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
                handleSelect(filteredItems[highlightedIndex]);
            } else if (filteredItems.length === 1) {
                handleSelect(filteredItems[0]);
            }
            break;
        case 'Tab':
            if (filteredItems.length === 1) {
                handleSelect(filteredItems[0]);
            }
            setIsOpen(false);
            break;
        case 'Escape':
            setIsOpen(false);
            break;
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        autoComplete="off"
      />
      {isOpen && filteredItems.length > 0 && (
        <ul ref={listRef} className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
          {filteredItems.map((item, index) => (
            <li
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-2 cursor-pointer text-slate-800 ${highlightedIndex === index ? 'bg-blue-100' : 'hover:bg-blue-100'}`}
            >
              <span className="font-semibold">{item.id}</span> - <span>{item.name}</span>
              {item.packingType === PackingType.Bales && item.baleSize > 0 && (
                <span className="text-slate-500 ml-2">({item.baleSize} Kg)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ItemSelector;
