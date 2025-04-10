import React, { useState } from 'react';

interface ListGroupProps {
    items: string[];
    heading: string;
}

function listGroup(props: ListGroupProps) {

    let items = ["new york", "los angeles", "chicago", "tokyo", "london"];
    const [selectedIndex, setSelectedIndex] = useState(-1);


    return (
        <>


            {items.length === 0 && <p>No items found</p>}
            <h1>List Group</h1>
            <ul className="list-group">
                {items.map((item, index) => (
                    <li key={index} className="list-group-item active" >{item}</li>
                ))}
            </ul>
        </>
    );


}
export default listGroup;