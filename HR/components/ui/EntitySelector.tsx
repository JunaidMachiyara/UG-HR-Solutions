import React, { useState, useEffect, useMemo, useRef } from 'react';

interface Entity {
  id: string;
  name: string;
}

interface EntityGroup {
    label: string;
    entities: Entity[];
}

interface EntitySelectorProps {
  entities?: Entity[];
  entityGroups?: EntityGroup[];
  selectedEntityId: string;
  onSelect: (entityId: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
}

const EntitySelector: React.FC<EntitySelectorProps> = ({ entities, entityGroups, selectedEntityId, onSelect, inputRef, placeholder = "Type to search...", disabled = false }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const flattenedEntities = useMemo(() => {
    if (entityGroups) {
        return entityGroups.flatMap(group => group.entities);
    }
    return entities || [];
  }, [entities, entityGroups]);

  const getEntityDisplayText = (entity: Entity | undefined): string => {
    return entity ? entity.name : '';
  };
  
  useEffect(() => {
    const selectedEntity = flattenedEntities.find(e => e.id === selectedEntityId);
    setInputValue(getEntityDisplayText(selectedEntity));
  }, [selectedEntityId, flattenedEntities]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selectedEntity = flattenedEntities.find(e => e.id === selectedEntityId);
        setInputValue(getEntityDisplayText(selectedEntity));
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, selectedEntityId, flattenedEntities]);

  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    // Query selector is needed for grouped lists where li is not a direct child
    const highlightedItem = listRef.current.querySelector(`[data-index='${highlightedIndex}']`);
    if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [highlightedIndex]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [inputValue]);

  const filteredGroups = useMemo(() => {
    if (!inputValue) {
        return entityGroups || [];
    }
    return entityGroups
        ?.map(group => ({
            ...group,
            entities: group.entities.filter(entity => 
                entity.name.toLowerCase().includes(inputValue.toLowerCase())
            )
        }))
        .filter(group => group.entities.length > 0) || [];
  }, [inputValue, entityGroups]);

  const filteredEntities = useMemo(() => {
    if (entityGroups) {
        return filteredGroups.flatMap(group => group.entities);
    }
    if (!inputValue) {
        return entities || [];
    }
    return entities?.filter(entity => 
        entity.name.toLowerCase().includes(inputValue.toLowerCase())
    ) || [];
  }, [inputValue, entities, entityGroups, filteredGroups]);

  const handleSelect = (entity: Entity) => {
    onSelect(entity.id);
    setInputValue(getEntityDisplayText(entity));
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
    if (disabled || !isOpen) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredEntities.length - 1 ? prev + 1 : prev));
            break;
        case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
            break;
        case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredEntities.length) {
                handleSelect(filteredEntities[highlightedIndex]);
            } else if (filteredEntities.length === 1) {
                handleSelect(filteredEntities[0]);
            }
            break;
        case 'Tab':
            if (isOpen && filteredEntities.length === 1) {
                handleSelect(filteredEntities[0]);
            }
            setIsOpen(false);
            break;
        case 'Escape':
            setIsOpen(false);
            break;
    }
  }
  
  const renderListItems = () => {
    if (entityGroups) {
        let indexCounter = -1;
        return filteredGroups.map(group => (
            <React.Fragment key={group.label}>
                <li className="px-4 py-2 bg-slate-100 text-slate-500 font-semibold text-xs sticky top-0 z-10">{group.label}</li>
                {group.entities.map(entity => {
                    indexCounter++;
                    const currentIndex = indexCounter;
                    return (
                        <li
                            key={entity.id}
                            data-index={currentIndex}
                            onClick={() => handleSelect(entity)}
                            onMouseEnter={() => setHighlightedIndex(currentIndex)}
                            className={`px-4 py-2 cursor-pointer text-slate-800 ${highlightedIndex === currentIndex ? 'bg-blue-100' : 'hover:bg-blue-100'}`}
                        >
                            {entity.name}
                        </li>
                    )
                })}
            </React.Fragment>
        ));
    }
    
    return filteredEntities.map((entity, index) => (
        <li
            key={entity.id}
            data-index={index}
            onClick={() => handleSelect(entity)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={`px-4 py-2 cursor-pointer text-slate-800 ${highlightedIndex === index ? 'bg-blue-100' : 'hover:bg-blue-100'}`}
        >
            {entity.name}
        </li>
    ));
  };

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
        className="w-full p-2 rounded-md disabled:bg-slate-200"
        autoComplete="off"
        disabled={disabled}
      />
      {isOpen && !disabled && (filteredEntities.length > 0 || (entityGroups && filteredGroups.length > 0)) && (
        <ul ref={listRef} className="absolute z-20 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
          {renderListItems()}
        </ul>
      )}
    </div>
  );
};

export default EntitySelector;
