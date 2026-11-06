'use client'

import { Header, ListBox, ListBoxItem, ListBoxSection, Separator } from 'react-aria-components'

import { Label } from '@/components/ui/label'

const ListBoxWithOptionGroupsDemo = () => {
  return (
    <div className='w-full max-w-xs space-y-2'>
      <Label>Listbox with option groups</Label>
      <div className='border-input overflow-hidden rounded-lg border'>
        <ListBox
          className='bg-background max-h-65 min-h-20 space-y-2 overflow-auto p-1 text-sm transition-colors'
          aria-label='Select some foods'
          selectionMode='multiple'
          defaultSelectedKeys={['english', 'tuna']}
        >
          <ListBoxSection className='space-y-1'>
            <Header className='text-muted-foreground px-2 py-1.5 text-xs font-medium'>European Languages</Header>
            <ListBoxItem
              id='english'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              English
            </ListBoxItem>
            <ListBoxItem
              id='french'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              French
            </ListBoxItem>
            <ListBoxItem
              id='spanish'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Spanish
            </ListBoxItem>
          </ListBoxSection>
          <Separator className='bg-border -mx-1 my-2 h-px' />
          <ListBoxSection className='space-y-1'>
            <Header className='text-muted-foreground px-2 py-1.5 text-xs font-medium'>Asian Languages</Header>
            <ListBoxItem
              id='hindi'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Hindi
            </ListBoxItem>
            <ListBoxItem
              id='japanese'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Japanese
            </ListBoxItem>
            <ListBoxItem
              id='mandarin'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Mandarin
            </ListBoxItem>
          </ListBoxSection>
          <Separator className='bg-border -mx-1 my-2 h-px' />
          <ListBoxSection className='space-y-1'>
            <Header className='text-muted-foreground px-2 py-1.5 text-xs font-medium'>Other Languages</Header>
            <ListBoxItem
              id='swahili'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Swahili
            </ListBoxItem>
            <ListBoxItem
              id='arabic'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Arabic
            </ListBoxItem>
            <ListBoxItem
              id='russian'
              className='data-focus-visible:border-ring data-focus-visible:ring-ring/50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative rounded-md px-2 py-1.5 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3'
            >
              Russian
            </ListBoxItem>
          </ListBoxSection>
        </ListBox>
      </div>
      <p className='text-muted-foreground text-xs' role='region' aria-live='polite'>
        Built using{' '}
        <a
          href='https://react-spectrum.adobe.com/react-aria/ListBox.html'
          className='hover:text-primary underline'
          target='_blank'
        >
          React Aria
        </a>
      </p>
    </div>
  )
}

export default ListBoxWithOptionGroupsDemo
